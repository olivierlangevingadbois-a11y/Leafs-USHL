/* =====================================================================
   RENDU
   ===================================================================== */
const $ = s => document.querySelector(s);
function flash(msg){
  const f = $('#flash'); f.textContent = msg; f.classList.add('visible');
  setTimeout(()=>f.classList.remove('visible'), 2600);
}
