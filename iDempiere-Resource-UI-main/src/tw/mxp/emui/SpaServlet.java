package tw.mxp.emui;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * Servlet for serving Single Page Application (SPA) resources.
 * Handles resource serving with fallback to index.html for client-side routes.
 */
public class SpaServlet extends HttpServlet {

    private static final String INDEX_HTML = "/index.html";
    private static final String PATH_SEPARATOR = "/";
    private static final String DEFAULT_MIME_TYPE = "application/octet-stream";
    private static final int BUFFER_SIZE = 4096;
    private static final String ERROR_MESSAGE_INDEX_MISSING = "index.html missing";

    @Override
    protected void doGet(
            HttpServletRequest request,
            HttpServletResponse response) throws ServletException, IOException {

        String path = buildPath(request);

        // Try to serve the requested resource
        if (serveResource(path, request, response)) {
            return;
        }

        // Resource not found - handle fallback to index.html for SPA routes
        handleResourceNotFound(path, request, response);
    }

    /**
     * Builds the full path from servlet path and path info.
     *
     * @param request the HTTP servlet request
     * @return the complete path
     */
    private String buildPath(HttpServletRequest request) {
        String path = request.getServletPath();
        String pathInfo = request.getPathInfo();
        if (pathInfo == null) {
            return path;
        }
        return path + pathInfo;
    }

    /**
     * Handles the case when a resource is not found.
     * Falls back to index.html for client-side routes, or returns 404 for assets.
     *
     * @param path the requested path
     * @param request the HTTP servlet request
     * @param response the HTTP servlet response
     * @throws IOException if an I/O error occurs
     */
    private void handleResourceNotFound(
            String path,
            HttpServletRequest request,
            HttpServletResponse response) throws IOException {

        // Prevent infinite loop if index.html itself is missing
        if (INDEX_HTML.equals(path)) {
            response.sendError(
                HttpServletResponse.SC_NOT_FOUND,
                ERROR_MESSAGE_INDEX_MISSING);
            return;
        }

        // If path has extension, it's likely a missing asset -> return 404
        if (hasExtension(path)) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        // Serve index.html for client-side routes
        if (serveResource(INDEX_HTML, request, response)) {
            return;
        }
        response.sendError(
            HttpServletResponse.SC_NOT_FOUND,
            ERROR_MESSAGE_INDEX_MISSING);
    }

    /**
     * Serves a resource from the web context.
     *
     * @param path the resource path to serve
     * @param request the HTTP servlet request
     * @param response the HTTP servlet response
     * @return true if the resource was served successfully, false otherwise
     * @throws IOException if an I/O error occurs
     */
    private boolean serveResource(
            String path,
            HttpServletRequest request,
            HttpServletResponse response) throws IOException {

        // Normalize path: append index.html for directory paths
        String normalizedPath = normalizePath(path);

        InputStream inputStream = getServletContext().getResourceAsStream(normalizedPath);
        if (inputStream == null) {
            return false;
        }

        try (InputStream input = inputStream) {
            String mimeType = getServletContext().getMimeType(normalizedPath);
            if (mimeType == null) {
                mimeType = DEFAULT_MIME_TYPE;
            }
            response.setContentType(mimeType);

            // Copy input stream to response output stream
            copyStream(input, response.getOutputStream());
        }

        return true;
    }

    /**
     * Normalizes a path by appending index.html if it ends with a slash.
     *
     * @param path the path to normalize
     * @return the normalized path
     */
    private String normalizePath(String path) {
        if (!path.endsWith(PATH_SEPARATOR)) {
            return path;
        }
        return path + "index.html";
    }

    /**
     * Copies data from an input stream to an output stream.
     *
     * @param input the input stream to read from
     * @param output the output stream to write to
     * @throws IOException if an I/O error occurs
     */
    private void copyStream(InputStream input, OutputStream output) throws IOException {
        byte[] buffer = new byte[BUFFER_SIZE];
        int bytesRead;
        while ((bytesRead = input.read(buffer)) != -1) {
            output.write(buffer, 0, bytesRead);
        }
    }

    /**
     * Checks if a path has a file extension.
     *
     * @param path the path to check
     * @return true if the path appears to have a file extension
     */
    private boolean hasExtension(String path) {
        int lastSlashIndex = path.lastIndexOf(PATH_SEPARATOR);
        String lastSegment = (lastSlashIndex >= 0)
            ? path.substring(lastSlashIndex + 1)
            : path;
        return lastSegment.contains(".");
    }
}
