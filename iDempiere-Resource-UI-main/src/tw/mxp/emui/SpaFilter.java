package tw.mxp.emui;

import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;
import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * Filter for Single Page Application (SPA) routing.
 * Handles client-side routing by forwarding non-existent routes to index.html.
 */
public class SpaFilter implements Filter {

    private static final String ROOT_PATH = "/";
    private static final String INDEX_HTML = "/index.html";
    private static final String PATH_SEPARATOR = "/";

    private FilterConfig filterConfig;

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        this.filterConfig = filterConfig;
    }

    @Override
    public void doFilter(
            ServletRequest request,
            ServletResponse response,
            FilterChain chain) throws IOException, ServletException {

        if (!(request instanceof HttpServletRequest) || 
            !(response instanceof HttpServletResponse)) {
            chain.doFilter(request, response);
            return;
        }

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String path = buildPath(httpRequest);

        // 1. Root path: let welcome-file handle it (usually index.html)
        if (ROOT_PATH.equals(path)) {
            chain.doFilter(request, response);
            return;
        }

        // 2. Check if the resource exists in the web context
        if (resourceExists(path)) {
            chain.doFilter(request, response);
            return;
        }

        // 3. Resource doesn't exist - check if it's a client-side route
        if (isAssetPath(path)) {
            // Likely a missing asset (image, css, js) -> 404 (let default servlet handle it)
            chain.doFilter(request, response);
            return;
        }

        // 4. Likely a client-side route -> forward to index.html
        request.getRequestDispatcher(INDEX_HTML).forward(request, response);
    }

    @Override
    public void destroy() {
        this.filterConfig = null;
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
     * Checks if a resource exists in the web context.
     *
     * @param path the resource path to check
     * @return true if the resource exists, false otherwise
     */
    private boolean resourceExists(String path) {
        try {
            URL url = filterConfig.getServletContext().getResource(path);
            return url != null;
        } catch (MalformedURLException e) {
            return false;
        }
    }

    /**
     * Determines if the path represents an asset file (has an extension).
     *
     * @param path the path to check
     * @return true if the path appears to be an asset file
     */
    private boolean isAssetPath(String path) {
        int lastSlashIndex = path.lastIndexOf(PATH_SEPARATOR);
        String lastSegment = (lastSlashIndex >= 0) 
            ? path.substring(lastSlashIndex + 1) 
            : path;
        return lastSegment.contains(".");
    }
}
