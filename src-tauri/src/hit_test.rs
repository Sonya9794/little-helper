//! Native input shape. Never substitute a rectangular hit box.
use crate::storage::Result;
use tauri::WebviewWindow;

fn runs(width: u32, height: u32, alpha: &[u8]) -> Vec<(i32, i32, i32)> {
    let mut result = Vec::new();
    for y in 0..height {
        let mut x = 0;
        while x < width {
            if alpha[(y * width + x) as usize] == 0 {
                x += 1;
                continue;
            }
            let start = x;
            while x < width && alpha[(y * width + x) as usize] != 0 {
                x += 1;
            }
            result.push((y as i32, start as i32, x as i32));
        }
    }
    result
}

pub fn install(
    window: &WebviewWindow,
    width: u32,
    height: u32,
    alpha: &[u8],
) -> Result<Option<String>> {
    if width == 0
        || height == 0
        || width > 1024
        || height > 1024
        || alpha.len() != (width * height) as usize
    {
        return Err("Invalid mascot alpha mask dimensions.".into());
    }
    let size = window.inner_size().map_err(|e| e.to_string())?;
    if size.width != width || size.height != height {
        return Err("Mascot scale changed; retry rendering the mask.".into());
    }
    let spans = runs(width, height, alpha);
    if spans.is_empty() {
        return Err("The mascot image has no visible pixels.".into());
    }
    #[cfg(target_os = "windows")]
    {
        windows::install(window, &spans)?;
        Ok(None)
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Safe limitation: never let an unsupported rectangular overlay intercept clicks.
        // macOS builds retain a decorative mascot; the tray opens the usable panel.
        let _ = spans;
        window
            .set_ignore_cursor_events(true)
            .map_err(|e| e.to_string())?;
        Ok(Some("macOS native alpha hit testing is not implemented in this Windows pilot. The mascot is decorative; open the menu with ‘Show Little Helper’ in the tray. macOS visual testing is still required.".into()))
    }
}

#[cfg(target_os = "windows")]
mod windows {
    use super::*;
    use std::ffi::c_void;
    type Handle = *mut c_void;
    #[repr(C)]
    #[derive(Default)]
    struct Point {
        x: i32,
        y: i32,
    }
    #[repr(C)]
    #[derive(Default)]
    struct Rect {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }
    #[link(name = "gdi32")]
    extern "system" {
        fn CreateRectRgn(left: i32, top: i32, right: i32, bottom: i32) -> Handle;
        fn CombineRgn(destination: Handle, source1: Handle, source2: Handle, mode: i32) -> i32;
        fn DeleteObject(object: Handle) -> i32;
    }
    #[link(name = "user32")]
    extern "system" {
        fn SetWindowRgn(window: Handle, region: Handle, redraw: i32) -> i32;
        fn GetWindowRect(window: Handle, rect: *mut Rect) -> i32;
        fn ClientToScreen(window: Handle, point: *mut Point) -> i32;
    }
    struct Region(Handle);
    impl Drop for Region {
        fn drop(&mut self) {
            unsafe {
                DeleteObject(self.0);
            }
        }
    }
    pub fn install(window: &WebviewWindow, spans: &[(i32, i32, i32)]) -> Result<()> {
        let hwnd = window.hwnd().map_err(|e| e.to_string())?;
        // SAFETY: HWND comes from the live Tauri window. Each HRGN is checked and
        // owned by Region until Windows takes ownership after SetWindowRgn succeeds.
        unsafe {
            // HRGN coordinates are window-relative, while the rendered alpha is
            // client-relative. Frameless Windows windows can have invisible borders.
            let mut origin = Point::default();
            let mut bounds = Rect::default();
            if ClientToScreen(hwnd.0 as Handle, &mut origin) == 0
                || GetWindowRect(hwnd.0 as Handle, &mut bounds) == 0
            {
                return Err(format!(
                    "Cannot align native alpha region: {}",
                    std::io::Error::last_os_error()
                ));
            }
            let dx = origin.x - bounds.left;
            let dy = origin.y - bounds.top;
            let region = Region(CreateRectRgn(0, 0, 0, 0));
            if region.0.is_null() {
                return Err("Cannot create native alpha region.".into());
            }
            for &(y, left, right) in spans {
                let row = Region(CreateRectRgn(left + dx, y + dy, right + dx, y + dy + 1));
                if row.0.is_null() || CombineRgn(region.0, region.0, row.0, 2) == 0 {
                    return Err("Cannot combine native alpha regions.".into());
                }
            }
            if SetWindowRgn(hwnd.0 as Handle, region.0, 1) == 0 {
                return Err(format!(
                    "Cannot set native alpha region: {}",
                    std::io::Error::last_os_error()
                ));
            }
            std::mem::forget(region);
        }
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn uses_every_nonzero_alpha_pixel_and_preserves_holes() {
        let alpha = [0, 1, 255, 0, 255, 0, 255, 0];
        assert_eq!(runs(4, 2, &alpha), vec![(0, 1, 3), (1, 0, 1), (1, 2, 3)]);
    }
}
