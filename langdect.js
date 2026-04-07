import langdetect from "langdetect";

const text = "मुझे बुखार है";

const language = langdetect.detectOne(text);

console.log(language);