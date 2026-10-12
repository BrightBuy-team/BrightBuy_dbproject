package com.brightbuy.backend.catalogue;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Iterator;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

final class ProductImageValidator {
    static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final int MAX_DIMENSION = 8_000;
    private static final long MAX_PIXELS = 20_000_000L;

    private ProductImageValidator() { }

    static ValidatedImage validate(MultipartFile file) {
        if (file.isEmpty() || file.getSize() > MAX_BYTES) {
            throw invalidImage();
        }
        try {
            byte[] bytes = file.getBytes();
            try (ImageInputStream stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                if (stream == null) {
                    throw invalidImage();
                }
                Iterator<ImageReader> readers = ImageIO.getImageReaders(stream);
                if (!readers.hasNext()) {
                    throw invalidImage();
                }
                ImageReader reader = readers.next();
                try {
                    reader.setInput(stream, true, true);
                    String format = reader.getFormatName().toLowerCase();
                    String extension = switch (format) {
                        case "jpeg", "jpg" -> "jpg";
                        case "png" -> "png";
                        default -> throw invalidImage();
                    };
                    int width = reader.getWidth(0);
                    int height = reader.getHeight(0);
                    if (width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION
                            || (long) width * height > MAX_PIXELS || reader.read(0) == null) {
                        throw invalidImage();
                    }
                    return new ValidatedImage(bytes, extension,
                            extension.equals("png") ? "image/png" : "image/jpeg");
                } finally {
                    reader.dispose();
                }
            }
        } catch (IOException exception) {
            throw new ResponseStatusException(BAD_REQUEST, "Choose a valid PNG or JPEG image.", exception);
        }
    }

    private static ResponseStatusException invalidImage() {
        return new ResponseStatusException(BAD_REQUEST,
                "Choose a PNG or JPEG image up to 5 MB and no larger than 20 megapixels.");
    }

    record ValidatedImage(byte[] bytes, String extension, String contentType) { }
}
