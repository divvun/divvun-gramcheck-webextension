# Divvun Grammar Checker Webextension

Enable the extension with these instructions: https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked

### TODO

- [ ] Implement message passing for wasm calls on sites that don't allow wasm such as github.com (see [this](https://github.com/theberrigan/rust-wasm-chrome-ext/blob/27da4da561f1fc93327d050ed6b6eb313e7254d6/extension/js/content.js#L4C1-L6C1))
- [ ] Implement support for `input` and other non-textarea input boxes.

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