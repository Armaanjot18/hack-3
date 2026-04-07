const langdetect = require("langdetect");

let text = "मुझे बुखार है";

let language = langdetect.detectOne(text);

console.log("Detected Language:", language);