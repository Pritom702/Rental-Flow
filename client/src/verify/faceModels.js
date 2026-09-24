// ============================================================
//  RentalFlow  |  Identity verification  |  Owner: M2 - Tawheed Bin Hamid (Pritom)
//  GitHub: @pritom702  |  Part: loading the face model in the browser
// ============================================================
// The face library (~1.3 MB) is only downloaded when a member reaches the
// selfie step — the rest of the app never pays for it. Two small models are
// enough on the phone: a fast face finder and the 68-point landmark model used
// for the blink / head-turn checks. The heavier face-MATCHING model runs only
// on the server, which makes the final decision.
let loading = null;

export function loadFaceApi() {
  if (!loading) {
    loading = (async () => {
      const faceapi = await import('@vladmandic/face-api/dist/face-api.esm.js');
      await faceapi.tf.ready();
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      return faceapi;
    })().catch((err) => { loading = null; throw err; });
  }
  return loading;
}
