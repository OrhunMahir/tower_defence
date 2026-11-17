// What the client modules share: the layout, the latest snapshot and the connection.
export const S = {
  layout: null,      // tables and castle geometry, the same for every game
  snap: null,        // the latest snapshot
  net: null,         // the running game: local rules or a server connection
  joined: false,
  run: null,         // how the current run was started: { daily } or {}
  award: null,       // what the finished run earned (renown, achievements), once it is over
  aiming: null,      // the ability being aimed: 'volley' | 'meteor' | null
  moving: null,      // uid of the defender being moved to another place
  hooks: {},         // scene functions the HUD may call: showRange, restart, leave, applySettings
};
export const send = (m) => { if (S.net) S.net.send(m); };
export const $ = (id) => document.getElementById(id);
