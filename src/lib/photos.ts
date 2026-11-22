// The photos of the public pages, each in the JPEG that is the fallback (`src`) and in three
// WebP widths (`srcSet`), so a phone downloads 20 to 80 KB instead of up to 365 KB. The WebP are
// the same pictures, recompressed and scaled from the JPEG (docs/design/images/CREDITS.md).
// Pass `sizes` the width the photo is painted at, or the browser assumes the full screen.
import kitchenJpg from '../../docs/design/images/pexels-16782087-cocinera-olla-cocina.jpg';
import kitchen1280 from '../../docs/design/images/pexels-16782087-cocinera-olla-cocina-1280.webp';
import kitchen640 from '../../docs/design/images/pexels-16782087-cocinera-olla-cocina-640.webp';
import kitchen960 from '../../docs/design/images/pexels-16782087-cocinera-olla-cocina-960.webp';
import deskJpg from '../../docs/design/images/pexels-39219973-hombre-telefono-escritorio.jpg';
import desk1600 from '../../docs/design/images/pexels-39219973-hombre-telefono-escritorio-1600.webp';
import desk640 from '../../docs/design/images/pexels-39219973-hombre-telefono-escritorio-640.webp';
import desk960 from '../../docs/design/images/pexels-39219973-hombre-telefono-escritorio-960.webp';
import phoneJpg from '../../docs/design/images/pexels-4747813-mujer-celular-lima.jpg';
import phone1600 from '../../docs/design/images/pexels-4747813-mujer-celular-lima-1600.webp';
import phone640 from '../../docs/design/images/pexels-4747813-mujer-celular-lima-640.webp';
import phone960 from '../../docs/design/images/pexels-4747813-mujer-celular-lima-960.webp';
import kettleJpg from '../../docs/design/images/pexels-13772359-tetera-llama-cocina.jpg';
import kettle1600 from '../../docs/design/images/pexels-13772359-tetera-llama-cocina-1600.webp';
import kettle640 from '../../docs/design/images/pexels-13772359-tetera-llama-cocina-640.webp';
import kettle960 from '../../docs/design/images/pexels-13772359-tetera-llama-cocina-960.webp';
import valvesJpg from '../../docs/design/images/unsplash-zENzDOsA2XA-balones-detalle-valvulas.jpg';
import valves1200 from '../../docs/design/images/unsplash-zENzDOsA2XA-balones-detalle-valvulas-1200.webp';
import valves640 from '../../docs/design/images/unsplash-zENzDOsA2XA-balones-detalle-valvulas-640.webp';
import valves960 from '../../docs/design/images/unsplash-zENzDOsA2XA-balones-detalle-valvulas-960.webp';

export type Photo = { src: string; srcSet: string };

export const KETTLE_PHOTO: Photo = {
  src: kettleJpg,
  srcSet: `${kettle640} 640w, ${kettle960} 960w, ${kettle1600} 1600w`,
};
export const KITCHEN_PHOTO: Photo = {
  src: kitchenJpg,
  srcSet: `${kitchen640} 640w, ${kitchen960} 960w, ${kitchen1280} 1280w`,
};
export const DESK_PHOTO: Photo = {
  src: deskJpg,
  srcSet: `${desk640} 640w, ${desk960} 960w, ${desk1600} 1600w`,
};
export const PHONE_PHOTO: Photo = {
  src: phoneJpg,
  srcSet: `${phone640} 640w, ${phone960} 960w, ${phone1600} 1600w`,
};
export const VALVES_PHOTO: Photo = {
  src: valvesJpg,
  srcSet: `${valves640} 640w, ${valves960} 960w, ${valves1200} 1200w`,
};
