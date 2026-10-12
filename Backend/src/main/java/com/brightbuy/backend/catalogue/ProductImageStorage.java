package com.brightbuy.backend.catalogue;

import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.azure.storage.blob.models.BlobHttpHeaders;
import com.azure.storage.blob.models.BlobStorageException;
import java.io.ByteArrayInputStream;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "BRIGHTBUY_AZURE_STORAGE_CONNECTION_STRING")
public class ProductImageStorage {
    private final BlobContainerClient container;

    public ProductImageStorage(
            @Value("${BRIGHTBUY_AZURE_STORAGE_CONNECTION_STRING}") String connectionString,
            @Value("${BRIGHTBUY_AZURE_STORAGE_CONTAINER}") String containerName) {
        BlobServiceClient service = new BlobServiceClientBuilder().connectionString(connectionString).buildClient();
        container = service.getBlobContainerClient(containerName);
    }

    public String upload(byte[] image, String extension, String contentType) {
        try {
            if (!container.exists()) {
                throw new ProductImageStorageException("The configured image container does not exist.");
            }
            String blobName = UUID.randomUUID() + "." + extension;
            var blob = container.getBlobClient(blobName);
            blob.upload(new ByteArrayInputStream(image), image.length, false);
            blob.setHttpHeaders(new BlobHttpHeaders().setContentType(contentType));
            return blob.getBlobUrl();
        } catch (BlobStorageException exception) {
            throw new ProductImageStorageException("Azure Blob Storage rejected the image upload.", exception);
        }
    }

    public static class ProductImageStorageException extends RuntimeException {
        private static final long serialVersionUID = 1L;

        public ProductImageStorageException(String message) {
            super(message);
        }

        public ProductImageStorageException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
