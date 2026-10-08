package com.brightbuy.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

// The default "inventory" profile needs a live MySQL server, which CI does not
// provide. The explicit test profile replaces it, so the context starts on the
// in-memory H2 test database. Live-database checks stay in CatalogueMySqlTests.
@SpringBootTest
@ActiveProfiles("test")
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
