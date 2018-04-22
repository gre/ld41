const keys = {};
for (let k = 0; k < 100; k++) {
  keys[k] = 0;
}

export function getUserEvents() {
  let keyRightDelta =
    (keys[39] || keys[68]) - (keys[37] || keys[65] || keys[81]);
  let keyUpDelta = (keys[38] || keys[87] || keys[90]) - (keys[40] || keys[83]);
  const rotateDelta = (keys[48] || keys[32]) - keys[49];
  return { keyUpDelta, keyRightDelta, rotateDelta };
}

const onKeyUp = (e: *) => {
  keys[e.which] = 0;
};

const onKeyDown = (e: *) => {
  if ((e.which >= 37 && e.which <= 40) || e.which === 32) e.preventDefault();
  keys[e.which] = 1;
};

document.body.addEventListener("keyup", onKeyUp);
document.body.addEventListener("keydown", onKeyDown);
