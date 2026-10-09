package com.brightbuy.backend;
import com.brightbuy.backend.checkout.dto.CartItemDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.json.JsonMapper;
import static org.assertj.core.api.Assertions.*;
@SpringBootTest @ActiveProfiles("test")
class StrictJsonTests {
 @Autowired JsonMapper mapper;
 @Test void wholeNumbersAccepted(){assertThat(mapper.readValue("{\"variantId\":1,\"quantity\":2}",CartItemDto.class).quantity()).isEqualTo(2);}
 @Test void fractionalQuantityNotTruncated(){assertThatThrownBy(()->mapper.readValue("{\"variantId\":1,\"quantity\":1.5}",CartItemDto.class)).isInstanceOf(Exception.class);}
 @Test void stringQuantityNotCoerced(){assertThatThrownBy(()->mapper.readValue("{\"variantId\":1,\"quantity\":\"2\"}",CartItemDto.class)).isInstanceOf(Exception.class);}
}
