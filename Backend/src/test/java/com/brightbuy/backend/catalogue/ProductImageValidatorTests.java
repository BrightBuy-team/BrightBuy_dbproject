package com.brightbuy.backend.catalogue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

class ProductImageValidatorTests {
    @Test
    void acceptsPngAndUsesDetectedContentType() throws Exception {
        var image = new BufferedImage(4, 3, BufferedImage.TYPE_INT_RGB);
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(image, "png", bytes);
        var file = new MockMultipartFile("file", "photo.png", "text/plain", bytes.toByteArray());

        var validated = ProductImageValidator.validate(file);

        assertThat(validated.extension()).isEqualTo("png");
        assertThat(validated.contentType()).isEqualTo("image/png");
        assertThat(validated.bytes()).containsExactly(bytes.toByteArray());
    }

    @Test
    void rejectsNonImageData() {
        var file = new MockMultipartFile("file", "photo.png", "image/png", "not an image".getBytes());

        assertThatThrownBy(() -> ProductImageValidator.validate(file))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("PNG or JPEG");
    }

    @Test
    void rejectsOversizedImagesBeforeDecoding() {
        var file = new MockMultipartFile("file", "large.png", "image/png",
                new byte[(int) ProductImageValidator.MAX_BYTES + 1]);

        assertThatThrownBy(() -> ProductImageValidator.validate(file))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("PNG or JPEG");
    }

    @Test
    void rejectsImagesAbovePixelLimit() throws Exception {
        var image = new BufferedImage(8_001, 1, BufferedImage.TYPE_INT_RGB);
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(image, "png", bytes);
        var file = new MockMultipartFile("file", "wide.png", "image/png", bytes.toByteArray());

        assertThatThrownBy(() -> ProductImageValidator.validate(file))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("20 megapixels");
    }
}
