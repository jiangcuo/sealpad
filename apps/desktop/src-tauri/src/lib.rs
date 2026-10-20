//! 印台桌面版外壳。
//!
//! 界面和 PDF 处理都在前端（apps/web）完成，原生层只提供浏览器做不到的能力。
//! 第一版只用到系统文件对话框和文件读写；后续阶段会在这里加入：
//! - 扫码手写签名用的局域网 HTTP 服务（一次性 token，签完即关）
//! - Word 转 PDF（Windows 调用 Word，其他平台调用 LibreOffice headless）
//! - 系统证书 / UKey 数字签名（PAdES）
//! - 印章加密存储与用章日志

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("SealPad 启动失败");
}
