# BrightBuy API

The backend serves JSON under `/api`. Locally the base address is `http://localhost:8080`.

## Sessions, CSRF and roles

- **Session.** `POST /api/auth/login` starts a server-side session and sets an HTTP-only
  session cookie. Send the cookie with every later request (`credentials: 'include'` in
  the browser). A session ends after 30 minutes without a request, or at sign-out.
- **CSRF.** Every `POST`, `PUT`, `PATCH` and `DELETE` needs the header `X-XSRF-TOKEN`.
  Get the value from `GET /api/auth/csrf` first. A write without it is answered with 403.
- **Roles.** A session belongs to a customer or to an employee with one role:
  `WarehouseStaff`, `Management` or `Admin`. An employee's role and active flag are read
  from the database again on every staff request, so disabling an account takes effect at once.

| Area | Guest | Customer | Warehouse staff | Management | Admin |
|---|---|---|---|---|---|
| Catalogue, delivery cities and preview | yes | yes | yes | yes | yes |
| Checkout, own orders, own address | | yes | | | |
| Inventory and catalogue maintenance | | | yes | | yes |
| Reports | | | | yes | |
| Create employees | | | | | yes |

## Errors

| Status | Meaning |
|---|---|
| 400 | A value is missing or invalid, or a business rule refused the change |
| 401 | Not signed in, or wrong email or password |
| 402 | The card was declined (checkout only) |
| 403 | Signed in without the needed role, or the CSRF token is missing |
| 404 | The record does not exist, or belongs to someone else |
| 409 | Conflict: duplicate SKU, name or email, or stock or price changed during checkout |
| 429 | Too many failed sign-ins for this email: 5 within 15 minutes |
| 503 | The service is unavailable; for card checkout, the gateway is switched off |

Account endpoints answer errors as `{"code": "...", "message": "..."}` and checkout as
`{"status": "...", "orderId": null, "unavailableVariantIds": [...]}`. Other errors carry
no detail. No answer ever contains SQL or a stack trace.

## Accounts — `/api/auth`

| Method and path | Access | Body | Answer |
|---|---|---|---|
| `GET /csrf` | anyone | | `{token}` |
| `POST /register` | anyone | `firstName`, `lastName`, `email`, `password` (8–72), optional `phone`, `addressLine`, `cityId` | 200 `{customerId, email}`; 409 if the email is taken |
| `POST /login` | anyone | `email`, `password`, `accountType` (`CUSTOMER` or `EMPLOYEE`) | 200 `{user: {id, email, accountType, role}}`; 401; 429 |
| `GET /me` | signed in | | `{user}`; 401 when not signed in |
| `POST /logout` | signed in | | 204 |
| `POST /password-reset/request` | anyone | `email`, `accountType` | Always 202 with the same message, whether or not the account exists |
| `POST /password-reset/confirm` | anyone | `code` (from the email), `newPassword` (8–72) | 204; 400 if the code is wrong, used or older than 30 minutes |
| `POST /employees` | Admin | `firstName`, `lastName`, `email`, `password`, optional `contactNo`, `role` (`WAREHOUSE_STAFF`, `MANAGEMENT`, `ADMIN`) | 201 `{employeeId, email, role}` |

`GET /api/addresses/me` returns the signed-in customer's default address
`{addressLine, cityId, cityName}`; `PUT /api/addresses/me` with `{addressLine, cityId}` changes it.

## Catalogue — `/api/catalogue` (public)

| Method and path | Parameters | Answer |
|---|---|---|
| `GET /products` | `keyword` (up to 255 characters), `categoryId`, `minPrice`, `maxPrice`, `inStockOnly`, `sort` (`name_asc`, `name_desc`, `price_asc`, `price_desc`, `newest`), `page`, `pageSize` (1–100, default 12) | `{page, page_size, sort, total_products, total_pages, items: [{product_id, sku, name, image_url, min_price, max_price, matching_variant_count, matching_stock_quantity}]}` |
| `GET /products/{productId}` | | The product with its categories and variants; 404 for a retired or unknown product |
| `GET /categories` | | `{items: [{category_id, parent_category_id, name, product_count, ...}]}` |

An unknown parameter or an invalid value is answered with 400.

## Catalogue maintenance — `/api/catalogue/staff` (warehouse staff, admin)

| Method and path | Body | Answer |
|---|---|---|
| `GET /products?keyword=&page=` | | Up to 100 products per page, including retired ones |
| `GET /categories`, `GET /warehouses` | | Lists for the forms |
| `GET /products/{id}/categories` | | The product's categories |
| `POST /products` | `sku`, `name`, `description`, `imageUrl`, `categoryId`, `price`, `stock` | 201 `{productId}`. Creates the product, its first category and its default variant together, in the central warehouse |
| `PUT /products/{id}` | `sku`, `name`, `description`, `imageUrl` | 200 |
| `PATCH /products/{id}/active` | `{active}` | 200. `false` retires the product; nothing is deleted |
| `POST /products/{id}/categories/{categoryId}` | | 200 |
| `DELETE /products/{id}/categories/{categoryId}` | | 200; 400 for the product's last category |
| `POST /categories` | `name`, `description`, `parentCategoryId`, `active` | 201 `{categoryId}` |
| `PUT /categories/{id}` | the same fields | 200 |

## Inventory — `/api/inventory` (warehouse staff, admin)

| Method and path | Body or parameters | Answer |
|---|---|---|
| `GET /variants` | | Every variant: `{variantId, productId, productName, sku, warehouseId, variantName, colour, memorySize, price, stockQuantity}` |
| `GET /low-stock?threshold=10` | | Variants with stock below the threshold |
| `POST /variants` | `productId`, `variantName`, `colour`, `memorySize`, `price`, `stock` | 201 with the new variant, held in the central warehouse |
| `PUT /variants/{id}` | `variantName`, `colour`, `memorySize`, `price` | 200 with the variant |
| `PUT /variants/{id}/stock?quantity=N` | | 200 with the variant. The change is written to the stock audit with the employee |

## Delivery — `/api/delivery`

| Method and path | Access | Answer |
|---|---|---|
| `GET /cities` | anyone | `[{cityId, name, isMainCity}]` |
| `GET /preview?cityId=1&variantIds=1,2&quantities=1,3` | anyone | `{estimated_delivery_date}`: 5 days for a main city, 7 otherwise, plus 3 if any line asks for more than is in stock. `quantities` is optional (one unit each when left out) and must match `variantIds` in length |
| `GET /estimate?cityId=1&orderId=101` | signed in | The estimate stored with an order. A customer sees only their own orders |

## Checkout and orders (customers)

`POST /api/checkout`

```json
{
  "cartItems": [{ "variantId": 1, "quantity": 2 }],
  "deliveryMode": "delivery",
  "paymentMethod": "card",
  "cityId": 1,
  "addressLine": "12 Main Street",
  "card": { "number": "4242424242424242", "expiryMonth": 12, "expiryYear": 2030, "cvv": "123", "holderName": "A Customer" }
}
```

`deliveryMode` is `delivery` or `pickup`; `cityId` and `addressLine` are needed for
delivery only. `paymentMethod` is `cod` or `card`; `card` is needed for card only. The
customer comes from the session and every price from the database, so neither can be sent.

| Status | `status` in the answer | Meaning |
|---|---|---|
| 201 | `SUCCESS` | Order placed; `orderId` is set |
| 400 | `INVALID_CART`, `DUPLICATE_VARIANTS_IN_CART`, `INVALID_DELIVERY_ADDRESS`, `INVALID_PAYMENT_DETAILS`, `INVALID_CARD`, ... | The request is wrong; nothing was changed |
| 402 | `CARD_DECLINED` | The gateway refused the card; no order |
| 409 | `ITEM_UNAVAILABLE` | A line is not sold any more (retired or unknown). `unavailableVariantIds` lists those lines; no order, no charge |
| 409 | `AUTHORISED_AMOUNT_MISMATCH` | A price changed between authorisation and confirmation; the authorisation is released |
| 503 | `PAYMENT_GATEWAY_UNAVAILABLE` | Card payments are switched off; cash on delivery still works |

**Out of stock is not a refusal.** A line that asks for more than is in stock is accepted:
the units in stock are taken, the rest is back-ordered, and the delivery estimate is 3 days
longer. The order's lines report this as `backorderedQuantity`. Stock never goes below zero.

For a card order the backend asks the database for the total, has the gateway authorise
exactly that amount, and only then places the order. If the order is then refused, the
authorisation is cancelled. The card number, expiry date and security code are passed to
the gateway and are never stored or logged; the order keeps the gateway's token and
reference, the card type and the last four digits.

The simulated gateway approves `4242424242424242` (Visa), `5555555555554444` (Mastercard)
and `378282246310005` (American Express) with any future expiry date, and declines every
other valid number.

`GET /api/orders` returns the signed-in customer's orders, newest first:
`{orderId, orderDate, orderStatus, totalAmount, deliveryMode, deliveryCity, deliveryAddress, estDeliveryDate, deliveryStatus, paymentMethod, paymentStatus, cardType, cardLastFour, items: [{productName, productSku, variantName, colour, memorySize, quantity, backorderedQuantity, unitPrice}]}`.

## Reports — `/api/reports` (management)

| Path | Parameters | Columns |
|---|---|---|
| `GET /quarterly-sales` | `year` (2000–2100) | `quarter`, `orderCount`, `totalRevenue` |
| `GET /top-selling-products` | `startDate`, `endDate`, `topN` (1–100, default 10) | `productId`, `name`, `unitsSold`, `revenue` |
| `GET /category-order-counts` | | `categoryId`, `name`, `totalOrders` |
| `GET /delivery-estimates` | | `orderId`, `firstName`, `lastName`, `deliveryMode`, `destinationCity`, `estDeliveryDate`, `deliveryStatus` |
| `GET /customer-order-summary` | | `customerId`, `firstName`, `lastName`, `lifetimeSpend`, `paymentStatuses` |

Each run is recorded in `report_access_log` with the signed-in employee.
