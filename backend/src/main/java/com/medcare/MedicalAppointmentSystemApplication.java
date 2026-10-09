package com.medcare;

import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import com.medcare.appointmentmanagement.Appointment;

/**
 * Entry point of the MedCare Medical Appointment Scheduling System.
 *
 * <pre>
 *   frontend/   the website the user sees   (HTML, CSS, JavaScript, images, fonts)
 *   backend/    this Maven project          (Java source - one package per component)
 * </pre>
 *
 * Run this class from IntelliJ (green play button), or from a terminal with
 * {@code mvn -f backend/pom.xml spring-boot:run}, and open
 * <a href="http://localhost:8080">http://localhost:8080</a>.
 *
 * <p>The database folder ({@code data}) and the readable text documents
 * ({@code documents}) are always created next to the {@code frontend} folder, no
 * matter whether the application is started from the project root or from inside
 * the {@code backend} folder.</p>
 */
@SpringBootApplication
public class MedicalAppointmentSystemApplication {

    public static void main(String[] args) {
        Path projectRoot = projectRoot();

        // Keep the database and the exported text documents together at the project
        // root so they are easy to find (data/, documents/) whatever the start folder.
        System.setProperty("spring.datasource.url",
                "jdbc:h2:file:" + projectRoot.resolve("data").resolve("medcare"));
        System.setProperty("app.output.dir", projectRoot.resolve("documents").toString());

        SpringApplication.run(MedicalAppointmentSystemApplication.class, args);
    }

    /** The folder that contains both the {@code frontend} and {@code backend} folders. */
    private static Path projectRoot() {
        Path here = Path.of("").toAbsolutePath();
        if (Files.isDirectory(here.resolve("frontend"))) {
            return here;
        }
        if (here.getFileName() != null && "backend".equals(here.getFileName().toString())
                && here.getParent() != null
                && Files.isDirectory(here.getParent().resolve("frontend"))) {
            return here.getParent();
        }
        return here;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void printStartupBanner() {
        System.out.println();
        System.out.println("======================================================================");
        System.out.println("  MEDCARE - MEDICAL APPOINTMENT SCHEDULING SYSTEM IS RUNNING");
        System.out.println("  Website             : http://localhost:8080");
        System.out.println("  Sign-in accounts    : admin/admin123 | reception/reception123");
        System.out.println("                        drsilva/doctor123 | nimasha/patient123");
        System.out.println("  Text file documents : ./documents   (also listed on the Documents page)");
        System.out.println("======================================================================");
        System.out.println();
    }
}
