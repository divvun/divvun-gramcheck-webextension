use wasm_bindgen::prelude::*;

// Enable better error messages when the wasm code panics
#[wasm_bindgen(start)]
pub fn main_js() -> Result<(), JsValue> {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
    Ok(())
}

// Export a function to JS
#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}