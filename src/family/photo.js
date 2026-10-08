/* ------------------------------------------------------------------ */
/*  Photo compression (fits comfortably in a Firestore document)       */
/* ------------------------------------------------------------------ */
export async function compressPhoto(file, charLimit = 600000) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("That format isn't supported — try a JPG or PNG"));
    i.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  let smallest = null;
  for (const max of [1100, 900, 700, 500]) {
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.75, 0.55, 0.4]) {
      const out = canvas.toDataURL("image/jpeg", q);
      if (!smallest || out.length < smallest.length) smallest = out;
      if (out.length < charLimit) return out;
    }
  }
  if (smallest && smallest.length < 950000) return smallest;
  throw new Error("Photo too large even after compression");
}
