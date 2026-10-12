# Stage 1: build the jar. Tests are run by the CI workflows, not here.
FROM eclipse-temurin:25-jdk AS builder
WORKDIR /app

# Dependencies first, so Docker reuses this layer until pom.xml changes.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw dependency:go-offline

COPY src ./src
RUN ./mvnw clean package -DskipTests

# Stage 2: run it on the smaller runtime image. All settings, including the
# database account, come from environment variables (see .env.example).
FROM eclipse-temurin:25-jre
WORKDIR /app
EXPOSE 8080
COPY --from=builder /app/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
