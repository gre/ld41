export const keys = {};
export const newKeyDown = {};
for (let k = 0; k < 100; k++) {
  keys[k] = 0;
  newKeyDown[k] = 0;
}

export function getUserEvents() {
  let keyRightDelta =
    (newKeyDown[39] || newKeyDown[68]) -
    (newKeyDown[37] || newKeyDown[65] || newKeyDown[81]);
  let keyUpDelta =
    (newKeyDown[38] || newKeyDown[87] || newKeyDown[90]) -
    (newKeyDown[40] || newKeyDown[83]);
  const action1 = newKeyDown[32];
  const rotateDelta =
    (newKeyDown[17] || newKeyDown[48]) - (newKeyDown[16] || newKeyDown[49]);

  for (let k = 0; k < 100; k++) {
    newKeyDown[k] = 0;
  }
  return { keyUpDelta, keyRightDelta, rotateDelta, action1 };
}

const onKeyUp = (e: *) => {
  keys[e.which] = 0;
};

const onKeyDown = (e: *) => {
  if (e.which === 32) e.preventDefault();
  console.log(e.which);
  keys[e.which] = 1;
  newKeyDown[e.which] = 1;
};

document.body.addEventListener("keyup", onKeyUp);
document.body.addEventListener("keydown", onKeyDown);
