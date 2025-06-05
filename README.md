### TODO

- [ ] Implement message passing for wasm calls on sites that don't allow wasm such as github.com (see [this](https://github.com/theberrigan/rust-wasm-chrome-ext/blob/27da4da561f1fc93327d050ed6b6eb313e7254d6/extension/js/content.js#L4C1-L6C1))
- [ ] Add button to overlay to trigger grammar check
- [ ] Add settings to overlay for which language to use
- [ ] Factor out args from PageScriptInterface and use parameter type to determine which command is being sent -- what happens if two functions share the same parameters?
- [ ] Add Divvun API integration for running grammar checks
- [ ] Test overlay with https://languagetool.org/webextension/welcome/finish?lang=en