const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('index.html', 'utf8');
const { window } = new JSDOM(html);

console.log("preview button:", !!window.document.getElementById('invPreviewBtn'));
console.log("save button:", !!window.document.getElementById('saveInvoiceBtn'));
console.log("scripts count:", window.document.querySelectorAll('script').length);
