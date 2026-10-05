#Stage 1 - Build the Application 
#pull a base image that contains Java 25 and standard Linux
FROM eclipse-temurin:25-jdk AS builder

#create a directory inside rge dcontainer called /app and move in to it
WORKDIR /app

#copy the Maven wrapper files from laptop into the container 
#this allows the container to download Maven automatically
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

#Give the Maven wrapper script permission to execute 
RUN chmod +x mvnw

#DOwnload the project dependence. Do this before the copying the source code
#so Docker can cache the downoad interner files to make future builds faster 
RUN ./mvnw dependency:go-offline

#copy the actual source code into the container 
COPY src ./src

#Run Maven to compile the code and build the final .jar file .
#We skip tests here because ,Github action CI pipeline will run this tests instead 
RUN ./mvnw clean package -DskipTests 


#Stage 2 - Run the application (The Runtime )

# Start a fresh, new stage using a smaller image (JRE instead of JDK)
# because only need to RUN  the code now , compile it 
FROM eclipse-temurin:25-jre

#Move into the /app directory in this new stage 
WORKDIR /app

#Expose port 8080 because that 
EXPOSE 8080

# This is the magic of multi-stage builds! 
# We copy the compiled .jar file FROM the "builder" stage into this clean runtime stage.
COPY --from=builder /app/target/*.jar app.jar

# Tell the container what command to run when it starts up.
ENTRYPOINT ["java", "-jar", "app.jar"]




 