package com.brightbuy.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

// Starts the whole application on an empty in-memory database (the test profile), so the
// wiring is checked without MySQL. Real SQL is exercised by scripts/verify-project.sh.
@SpringBootTest
@ActiveProfiles("test")
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
