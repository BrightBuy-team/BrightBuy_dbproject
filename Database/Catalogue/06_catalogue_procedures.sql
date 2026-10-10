-- BrightBuy catalogue read procedures, MySQL 8.0.19+.
-- Install after tables, indexes and variant integration. Safe to reinstall.
-- Returns JSON through OUT parameters; does not alter data or commit callers.
USE brightbuy;

-- Zero-stock options remain visible. Invalid inventory rows cannot supply a
-- storefront price. Checkout must still revalidate price/stock atomically.
CREATE OR REPLACE SQL SECURITY INVOKER VIEW catalogue_public_variants AS
SELECT v.variant_id, v.product_id, v.warehouse_id, v.variant_name,
       v.colour, v.memory_size, v.price, v.stock_quantity
FROM variant v
JOIN product p ON p.product_id = v.product_id
WHERE p.is_active = TRUE AND v.price >= 0 AND v.stock_quantity >= 0;

DROP PROCEDURE IF EXISTS sp_catalogue_search;
DROP PROCEDURE IF EXISTS sp_catalogue_categories;
DROP PROCEDURE IF EXISTS sp_catalogue_product_detail;

DELIMITER $$

CREATE PROCEDURE sp_catalogue_search(
    IN p_keyword TEXT,
    IN p_category_id INT,
    IN p_min_price DECIMAL(10,2),
    IN p_max_price DECIMAL(10,2),
    IN p_in_stock_only TINYINT,
    IN p_sort VARCHAR(32),
    IN p_page INT,
    IN p_page_size INT,
    OUT p_result JSON
)
SQL SECURITY INVOKER
READS SQL DATA
BEGIN
    DECLARE search_keyword VARCHAR(255);
    DECLARE sort_key VARCHAR(32);
    DECLARE row_offset BIGINT;
    SET p_result = NULL;

    IF p_page IS NULL OR p_page < 1 OR p_page > 1000000 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'page must be between 1 and 1000000';
    END IF;
    IF p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'page_size must be between 1 and 100';
    END IF;
    IF p_category_id IS NOT NULL AND p_category_id < 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'category_id must be positive or NULL';
    END IF;
    IF p_min_price < 0 OR p_max_price < 0 OR p_min_price > p_max_price THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'price bounds must be nonnegative and min must not exceed max';
    END IF;
    IF p_in_stock_only IS NULL OR p_in_stock_only NOT IN (0,1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'in_stock_only must be 0 or 1';
    END IF;
    IF CHAR_LENGTH(TRIM(p_keyword)) > 255 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'keyword must not exceed 255 characters';
    END IF;
    SET search_keyword = NULLIF(TRIM(p_keyword), '');
    SET sort_key = COALESCE(NULLIF(LOWER(TRIM(p_sort)), ''), 'name_asc');
    IF sort_key NOT IN ('name_asc','name_desc','price_asc','price_desc','newest') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'unsupported catalogue sort';
    END IF;
    SET row_offset = (CAST(p_page AS SIGNED) - 1) * p_page_size;

    -- EXISTS avoids duplicate products with multiple category assignments.
    -- Aggregate ONLY matching variants: price and stock must match one row.
    -- Separate FULLTEXT from substring matching so MySQL can use the FULLTEXT
    -- index. Putting MATCH inside an OR evaluated it for every joined variant.
    -- UNION retains the same keyword semantics and deduplicates candidate IDs.
    WITH keyword_products AS (
        SELECT product_id FROM product WHERE search_keyword IS NULL
        UNION
        SELECT product_id FROM product WHERE search_keyword IS NOT NULL
          AND MATCH(name, description) AGAINST(search_keyword IN NATURAL LANGUAGE MODE) > 0
        UNION
        SELECT product_id FROM product WHERE search_keyword IS NOT NULL
          AND (LOCATE(search_keyword,name)>0
            OR LOCATE(search_keyword,COALESCE(description,''))>0
            OR LOCATE(search_keyword,sku)>0)
    ), matches AS (
        SELECT p.product_id, p.sku, p.name, p.image_url, p.created_at,
               MIN(v.price) AS min_price, MAX(v.price) AS max_price,
               COUNT(*) AS matching_variant_count,
               SUM(v.stock_quantity) AS matching_stock_quantity
        FROM product p
        JOIN keyword_products k ON k.product_id = p.product_id
        JOIN catalogue_public_variants v ON v.product_id = p.product_id
        WHERE (p_min_price IS NULL OR v.price >= p_min_price)
          AND (p_max_price IS NULL OR v.price <= p_max_price)
          AND (p_in_stock_only = 0 OR v.stock_quantity > 0)
          AND (p_category_id IS NULL OR EXISTS (
              SELECT 1 FROM product_category pc
              JOIN category c ON c.category_id = pc.category_id
              LEFT JOIN category parent ON parent.category_id = c.parent_category_id
              WHERE pc.product_id = p.product_id AND c.is_active = TRUE
                AND (c.parent_category_id IS NULL OR parent.is_active = TRUE)
                AND (c.category_id = p_category_id OR c.parent_category_id = p_category_id)
          ))
        GROUP BY p.product_id
    ), ranked AS (
        SELECT matches.*, ROW_NUMBER() OVER (ORDER BY
            CASE WHEN sort_key = 'name_asc' THEN name END ASC,
            CASE WHEN sort_key = 'name_desc' THEN name END DESC,
            CASE WHEN sort_key = 'price_asc' THEN min_price END ASC,
            CASE WHEN sort_key = 'price_desc' THEN min_price END DESC,
            CASE WHEN sort_key = 'newest' THEN created_at END DESC,
            product_id ASC) AS position
        FROM matches
    ), page_rows AS (
        SELECT * FROM ranked WHERE position > row_offset AND position <= row_offset + p_page_size
    ), packed AS (
        -- Window ordering guarantees JSON array order without GROUP_CONCAT limits.
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'product_id', product_id, 'sku', sku, 'name', name, 'image_url', image_url,
            'min_price', min_price, 'max_price', max_price,
            'matching_variant_count', matching_variant_count,
            'matching_stock_quantity', matching_stock_quantity
        )) OVER (ORDER BY position ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS items
        FROM page_rows
    )
    SELECT JSON_OBJECT(
        'page', p_page, 'page_size', p_page_size, 'sort', sort_key,
        'total_products', (SELECT COUNT(*) FROM matches),
        'total_pages', CEIL((SELECT COUNT(*) FROM matches) / p_page_size),
        'items', COALESCE((SELECT items FROM packed LIMIT 1), JSON_ARRAY())
    ) INTO p_result;
END$$

CREATE PROCEDURE sp_catalogue_categories(OUT p_result JSON)
SQL SECURITY INVOKER
READS SQL DATA
BEGIN
    WITH counts AS (
        SELECT c.category_id, c.parent_category_id, c.name, c.description,
            (SELECT COUNT(DISTINCT pc.product_id)
             FROM product_category pc
             JOIN category linked ON linked.category_id = pc.category_id
             LEFT JOIN category parent ON parent.category_id = linked.parent_category_id
             JOIN catalogue_public_variants v ON v.product_id = pc.product_id
             WHERE linked.is_active = TRUE
               AND (linked.parent_category_id IS NULL OR parent.is_active = TRUE)
               AND (linked.category_id = c.category_id OR linked.parent_category_id = c.category_id)
            ) AS product_count
        FROM category c
        LEFT JOIN category parent ON parent.category_id = c.parent_category_id
        WHERE c.is_active = TRUE AND (c.parent_category_id IS NULL OR parent.is_active = TRUE)
    ), packed AS (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'category_id', category_id, 'parent_category_id', parent_category_id,
            'name', name, 'description', description, 'product_count', product_count
        )) OVER (ORDER BY parent_category_id IS NOT NULL, name, category_id
                 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS items
        FROM counts
    )
    SELECT JSON_OBJECT('items', COALESCE((SELECT items FROM packed LIMIT 1), JSON_ARRAY())) INTO p_result;
END$$

CREATE PROCEDURE sp_catalogue_product_detail(IN p_product_id INT, OUT p_result JSON)
SQL SECURITY INVOKER
READS SQL DATA
BEGIN
    SET p_result = NULL;
    IF p_product_id IS NULL OR p_product_id < 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'product_id must be positive';
    END IF;

    WITH options AS (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'variant_id', variant_id, 'warehouse_id', warehouse_id, 'variant_name', variant_name,
            'colour', colour, 'memory_size', memory_size, 'price', price, 'stock_quantity', stock_quantity
        )) OVER (ORDER BY price, variant_id
                 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS items
        FROM catalogue_public_variants WHERE product_id = p_product_id
    ), categories AS (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'category_id', c.category_id, 'parent_category_id', c.parent_category_id, 'name', c.name
        )) OVER (ORDER BY c.parent_category_id IS NOT NULL, c.name, c.category_id
                 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS items
        FROM product_category pc JOIN category c ON c.category_id = pc.category_id
        LEFT JOIN category parent ON parent.category_id = c.parent_category_id
        WHERE pc.product_id = p_product_id AND c.is_active = TRUE
          AND (c.parent_category_id IS NULL OR parent.is_active = TRUE)
    )
    SELECT (SELECT JSON_OBJECT(
        'product_id', p.product_id, 'sku', p.sku, 'name', p.name,
        'description', p.description, 'image_url', p.image_url,
        'categories', COALESCE((SELECT items FROM categories LIMIT 1), JSON_ARRAY()),
        'variants', (SELECT items FROM options LIMIT 1)
    ) FROM product p WHERE p.product_id = p_product_id AND p.is_active = TRUE
      AND EXISTS (SELECT 1 FROM options)) INTO p_result;

    IF p_result IS NULL THEN
        SIGNAL SQLSTATE '45004' SET MESSAGE_TEXT = 'Product not found or unavailable';
    END IF;
END$$

DELIMITER ;
