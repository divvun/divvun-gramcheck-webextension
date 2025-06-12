# Divvun Grammar Checker Webextension

A proof-of-concept Google Chrome webextension that works with standard `<textarea>` HTML elements and uses the [Divvun API](https://github.com/divvun/divvun-api) to detect errors.

### Setup
1. Checkout this repo
2. Build the extension with `deno task build`. This will generate a `dist` folder
3. Open Google Chrome and follow [these instructions to enable an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked), navigating to the newly-generated `dist` folder
4. Navigate to one of the below testing websites and enter some text. Your grammar will be checked as you type, and errors will appear underlined in red. Clicking an underlined word will show you suggestions to help improve your writing.

### Rust-wasm

This repo also shows it is possible to integrate Rust-based web assembly (rust-wasm) for high-performance upgrades in the future. For now, this integration works by implementing an `add()` function in Rust, which is compiled to wasm and called by the web extension to add two numbers. To see its output, navigate to one of the test sites (aside from github, which doesn't allow wasm), and open Chrome's browser console. There you will see the output of the `add()` function.

In the future, Rust-wasm can be used to optimize the grammar checker as required.

### Test sites

Sites that can be used to test:
- https://github.com
- https://pastebin.com/
- https://borealium.org/en/resource/voice-se-female/
- https://news.ycombinator.com/
- https://preview.colorlib.com/theme/bootstrap/contact-form-16/


Sites known to cause problems:
- https://stackoverflow.com/questions/ask
- https://www.chakra-ui.com/docs/components/textarea
- https://colorlib.com/etc/cf/ContactFrom_v19/index.html

### TODO

- [ ] Implement message passing for wasm calls on sites that don't allow wasm such as github.com (see [this](https://github.com/theberrigan/rust-wasm-chrome-ext/blob/27da4da561f1fc93327d050ed6b6eb313e7254d6/extension/js/content.js#L4C1-L6C1))
- [ ] Implement support for `input` and other non-textarea input boxes.