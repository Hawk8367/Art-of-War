const state = {
  lobbyId: "",
  token: "",
  inviteLink: "",
  pollHandle: null,
  snapshot: null,
  selectedLogDay: null,
  pendingSnapshot: null,
  suppressRenderWhileEditing: false,
  setupDraft: {
    Parliament: "",
    Base: "",
    Office: "",
  },
  turnDraft: null,
  lastSeenDisplayDay: null,
};

const moveDescriptions = {
  Strike: "30 gold. Deal 30 damage to one target tower.",
  "Target Strike": "40 gold. Deal 40 damage, or 80 if you correctly guess that tower's character.",
  "Siege Operation": "80 gold. Set up a siege for next day.",
  "Coordinated Assault": "45 gold. Stronger follow-up if you attacked that tower last round.",
  "Distributed Assault": "50 gold. Hit 3 separate towers with optional guesses.",
  Fortify: "45 gold. One tower takes reduced damage.",
  Repair: "30 gold. Restore 40 HP.",
  Evacuation: "70 gold. A tower survives at 1 HP if it would be destroyed.",
  Sabotage: "50 gold. Cancels one incoming siege.",
  "Signal Jam": "40 gold. Blocks intel against your nation.",
  Interception: "50 gold. Stop predicted attacks from one nation.",
  Counter: "70 gold. Stops the first attack and returns 60 damage.",
  "Deep Surveillance": "100 gold. Learn a tower character.",
  "Identity Check": "40 gold. Check if a nation uses a character.",
  "Move Check": "60 gold. Learn all moves chosen by a nation.",
  "War Mobilization": "Free. Gain one extra action this day.",
  "Strategic Reserve": "Free. Gain 50 gold immediately.",
  "Full Exposure": "Free. Guess all 3 enemy tower characters for 200 gold.",
  "Priority Target": "30 gold. Your attacks gain +15 damage against one tower.",
  "Leader's Intervention": "65 gold. One chosen move from one nation fails.",
  "Total Mobilization": "150 gold. Remove repeat-move limits permanently.",
  "Expanded Command": "70 gold. Remove the action-count cap this day.",
};

const el = {
  heroStatus: document.getElementById("hero-status"),
  heroLobby: document.getElementById("hero-lobby"),
  landingPanel: document.getElementById("landing-panel"),
  lobbyPanel: document.getElementById("lobby-panel"),
  gamePanel: document.getElementById("game-panel"),
  logPanel: document.getElementById("log-panel"),
  createName: document.getElementById("create-name"),
  createSize: document.getElementById("create-size"),
  joinName: document.getElementById("join-name"),
  joinCode: document.getElementById("join-code"),
  createLobbyButton: document.getElementById("create-lobby-button"),
  joinLobbyButton: document.getElementById("join-lobby-button"),
  inviteLink: document.getElementById("invite-link"),
  copyLinkButton: document.getElementById("copy-link-button"),
  lobbyRoster: document.getElementById("lobby-roster"),
  setupPanel: document.getElementById("setup-panel"),
  setupGrid: document.getElementById("setup-grid"),
  readyButton: document.getElementById("ready-button"),
  turnHeading: document.getElementById("turn-heading"),
  statusBanner: document.getElementById("status-banner"),
  scoreboard: document.getElementById("scoreboard"),
  playerForm: document.getElementById("player-form"),
  submitTurnButton: document.getElementById("submit-turn-button"),
  logTabs: document.getElementById("log-tabs"),
  globalLog: document.getElementById("global-log"),
  moveGuideButton: document.getElementById("move-guide-button"),
  moveGuideModal: document.getElementById("move-guide-modal"),
  moveGuideClose: document.getElementById("move-guide-close"),
  moveGuideDismiss: document.getElementById("move-guide-dismiss"),
  moveGuideContent: document.getElementById("move-guide-content"),
};

function saveSession() {
  localStorage.setItem("art-of-war-session", JSON.stringify({ lobbyId: state.lobbyId, token: state.token }));
}

function loadSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem("art-of-war-session") || "{}");
    state.lobbyId = parsed.lobbyId || new URLSearchParams(window.location.search).get("lobby") || "";
    state.token = parsed.token || "";
  } catch {
    state.lobbyId = new URLSearchParams(window.location.search).get("lobby") || "";
    state.token = "";
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

function beginPolling() {
  if (state.pollHandle) clearInterval(state.pollHandle);
  state.pollHandle = setInterval(refreshState, 2000);
}

async function refreshState() {
  if (!state.lobbyId || !state.token) return;
  try {
    const snapshot = await api(`/api/state?lobby=${encodeURIComponent(state.lobbyId)}&token=${encodeURIComponent(state.token)}`);
    if (state.suppressRenderWhileEditing) {
      state.pendingSnapshot = snapshot;
      return;
    }
    applySnapshot(snapshot);
  } catch (error) {
    el.heroStatus.textContent = error.message;
  }
}

function applySnapshot(snapshot) {
  const previousDay = state.snapshot?.game?.displayDay ?? state.lastSeenDisplayDay;
  const wasStarted = state.snapshot?.game?.started;
  state.snapshot = snapshot;
  state.pendingSnapshot = null;
  state.inviteLink = `${window.location.origin}/?lobby=${snapshot.lobbyId}`;
  if (wasStarted && previousDay !== null && snapshot.game.displayDay > previousDay) {
    window.alert(`All players submitted. Day ${snapshot.game.displayDay} has begun.`);
  }
  state.lastSeenDisplayDay = snapshot.game.displayDay;
  render();
}

function renderRoster(snapshot) {
  el.lobbyRoster.innerHTML = snapshot.roster
    .map((player) => `
      <div class="score-card">
        <h3>${player.displayName}</h3>
        <p class="meta-text">${player.nationName}</p>
      </div>
    `)
    .join("");
}

function renderSetup(snapshot) {
  const you = snapshot.game.you;
  el.setupPanel.classList.toggle("hidden", snapshot.game.started);
  if (snapshot.game.started) return;
  const draft = {
    Parliament: state.setupDraft.Parliament || you.towers.Parliament.character || snapshot.constants.characters[0],
    Base: state.setupDraft.Base || you.towers.Base.character || snapshot.constants.characters[1] || snapshot.constants.characters[0],
    Office: state.setupDraft.Office || you.towers.Office.character || snapshot.constants.characters[2] || snapshot.constants.characters[0],
  };
  el.setupGrid.innerHTML = `
    <div class="player-card">
      <h3>${you.nationName}</h3>
      <div class="tower-grid">
        ${snapshot.constants.towers.map((tower) => `
          <div class="tower-box">
            <label class="compact-label" for="setup-${tower}">${tower}</label>
            <select id="setup-${tower}">
              ${snapshot.constants.characters.map((character) => `<option value="${character}" ${draft[tower] === character ? "selected" : ""}>${character}</option>`).join("")}
            </select>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  snapshot.constants.towers.forEach((tower) => {
    const select = document.getElementById(`setup-${tower}`);
    select.addEventListener("change", () => {
      state.setupDraft[tower] = select.value;
    });
  });
}

function nationOptions(snapshot, includeEmpty = true) {
  const currentSeat = snapshot.game.playerSeat;
  const options = snapshot.game.nations
    .filter((nation) => nation.seat !== currentSeat)
    .map((nation) => `<option value="${nation.seat}">${nation.nationName}</option>`);
  return `${includeEmpty ? '<option value="">None</option>' : ""}${options.join("")}`;
}

function towerOptions() {
  return `<option value="">None</option><option value="Parliament">Parliament</option><option value="Base">Base</option><option value="Office">Office</option>`;
}

function characterOptions(optionalLabel = "None") {
  return `<option value="">${optionalLabel}</option>${state.snapshot.constants.characters.map((character) => `<option value="${character}">${character}</option>`).join("")}`;
}

function renderGame(snapshot) {
  const you = snapshot.game.you;
  if (!state.turnDraft || state.turnDraft.day !== snapshot.game.displayDay) {
    state.turnDraft = createEmptyTurnDraft(snapshot);
  }
  el.turnHeading.textContent = `Day ${snapshot.game.displayDay} - ${you.nationName}`;
  el.statusBanner.innerHTML = `
    <strong>${you.nationName}</strong>
    <br>
    <span class="meta-text">Gold: ${you.gold} | Score: ${you.score} | Submitted today: ${you.lastSubmittedDay === snapshot.game.displayDay ? "Yes" : "No"}</span>
  `;

  el.scoreboard.innerHTML = snapshot.game.nations.map((nation) => `
    <div class="score-card">
      <h3>${nation.nationName}</h3>
      ${
        nation.seat === snapshot.game.playerSeat
          ? `
            <div class="tower-grid">
              ${Object.entries(nation.towers).map(([tower, data]) => `
                <div class="tower-box ${data.hp <= 0 ? "dead" : ""}">
                  <span class="compact-label">${tower}</span>
                  <strong>${data.hp} HP</strong>
                </div>
              `).join("")}
            </div>
          `
          : `<p class="meta-text">Enemy tower health is hidden.</p>`
      }
    </div>
  `).join("");

  const activeTreaties = you.activeTreaties.map((treaty) => `<div class="subtle-box">Active treaty with ${treaty.withNation}: ${treaty.remaining} day(s)</div>`).join("");
  const incomingOffers = you.incomingTreaties.map((offer) => `
    <div class="subtle-box">
      <p class="meta-text">${offer.fromNation} proposed a ${offer.duration}-day treaty.</p>
      <select data-offer-id="${offer.offerId}" class="treaty-response-select">
        <option value="">No response</option>
        <option value="accept">Accept</option>
        <option value="decline">Decline</option>
      </select>
    </div>
  `).join("");

  const decisionOptions = `<option value="">No decision</option>${snapshot.constants.nationalDecisions.map((decision) => `<option value="${decision}">${decision}</option>`).join("")}`;
  const actionOptions = `<option value="">No action</option>${[
    ...snapshot.constants.attackActions,
    ...snapshot.constants.defenseActions,
    ...snapshot.constants.intelActions,
  ].map((action) => `<option value="${action}">${action}</option>`).join("")}`;

  el.playerForm.innerHTML = `
    <section class="action-card">
      <h3>Your Turn</h3>
      <div class="subtle-box">
        <span class="compact-label">Treaties</span>
        ${activeTreaties || '<div class="meta-text">No active treaties.</div>'}
        ${incomingOffers}
        <div class="inline-grid">
          <div>
            <label class="compact-label" for="treaty-target">Propose Treaty To</label>
            <select id="treaty-target">${nationOptions(snapshot)}</select>
          </div>
          <div>
            <label class="compact-label" for="treaty-duration">Duration</label>
            <select id="treaty-duration">
              <option value="1">1 day</option>
              <option value="2" selected>2 days</option>
              <option value="3">3 days</option>
            </select>
          </div>
        </div>
      </div>

      <div class="subtle-box">
        <span class="compact-label">National Decision</span>
        <div class="action-row">
          <label class="compact-label" for="decision-type">Decision</label>
          <select id="decision-type">${decisionOptions}</select>
          <div id="decision-details" class="hidden">
            <div id="decision-priority-wrap" class="hidden">
              <label class="compact-label" for="decision-target">Target Nation</label>
              <select id="decision-target">${nationOptions(snapshot)}</select>
              <label class="compact-label" for="decision-payload">Target Tower</label>
              <select id="decision-payload">${towerOptions()}</select>
            </div>
            <div id="decision-intervention-wrap" class="hidden">
              <label class="compact-label" for="decision-target-intervention">Target Nation</label>
              <select id="decision-target-intervention">${nationOptions(snapshot)}</select>
              <label class="compact-label" for="decision-action">Blocked Action</label>
              <select id="decision-action">
                <option value="">Select action</option>
                ${[...snapshot.constants.attackActions, ...snapshot.constants.defenseActions, ...snapshot.constants.intelActions].map((action) => `<option value="${action}">${action}</option>`).join("")}
              </select>
            </div>
            <div id="decision-exposure-wrap" class="hidden">
              <label class="compact-label" for="decision-target-exposure">Target Nation</label>
              <select id="decision-target-exposure">${nationOptions(snapshot)}</select>
              <div class="tower-grid">
                ${snapshot.constants.towers.map((tower) => `
                  <div>
                    <label class="compact-label" for="fe-${tower}">${tower} Guess</label>
                    <select id="fe-${tower}">${characterOptions("Select character")}</select>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="action-grid">
        ${Array.from({ length: 8 }, (_, index) => `
          <div class="action-row">
            <h3>Action ${index + 1}</h3>
            <label class="compact-label" for="action-type-${index}">Move</label>
            <select id="action-type-${index}">${actionOptions}</select>
            <label class="compact-label hidden" id="action-target-label-${index}" for="action-target-${index}">Target Nation</label>
            <select id="action-target-${index}" class="hidden">${nationOptions(snapshot)}</select>
            <label class="compact-label hidden" id="action-tower-label-${index}" for="action-tower-${index}">Target Tower</label>
            <select id="action-tower-${index}" class="hidden">${towerOptions()}</select>
            <div id="action-guess-wrap-${index}" class="hidden">
              <label class="compact-label" for="action-guess-${index}">Character Guess</label>
              <select id="action-guess-${index}">${characterOptions("No guess")}</select>
            </div>
            <div id="distributed-wrap-${index}" class="distributed-grid hidden">
              ${Array.from({ length: 3 }, (_, dist) => `
                <div class="subtle-box distributed-row">
                  <span class="compact-label">Distributed ${dist + 1}</span>
                  <select id="dist-target-${index}-${dist}">${nationOptions(snapshot)}</select>
                  <select id="dist-tower-${index}-${dist}">${towerOptions()}</select>
                  <select id="dist-guess-${index}-${dist}">${characterOptions("No guess")}</select>
                </div>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;

  hydrateTurnDraft(snapshot);
  bindTurnDraftEvents(snapshot);
}

function renderLogs(snapshot) {
  const history = snapshot.game.you.resolutionHistory || {};
  const days = snapshot.game.you.logDays || [];
  if (days.length && !days.includes(state.selectedLogDay)) {
    state.selectedLogDay = days[days.length - 1];
  }
  el.logTabs.innerHTML = days.map((day) => `
    <button type="button" class="log-tab ${day === state.selectedLogDay ? "active" : ""}" data-log-day="${day}">Day ${day}</button>
  `).join("");
  el.logTabs.querySelectorAll("[data-log-day]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedLogDay = Number(button.dataset.logDay);
      renderLogs(snapshot);
    });
  });
  const entries = history[state.selectedLogDay] || [];
  el.globalLog.innerHTML = entries.length
    ? entries.map((entry) => `<div class="log-entry">${entry}</div>`).join("")
    : `<div class="log-entry">No private results yet.</div>`;
}

function render() {
  const snapshot = state.snapshot;
  el.heroStatus.textContent = snapshot ? (snapshot.game.finished ? "Match Complete" : snapshot.game.started ? "In Match" : "Lobby Open") : "Not Connected";
  el.heroLobby.textContent = state.lobbyId || "None";
  el.inviteLink.textContent = state.inviteLink || "";

  const connected = Boolean(snapshot);
  el.landingPanel.classList.toggle("hidden", connected);
  el.lobbyPanel.classList.toggle("hidden", !connected);
  el.gamePanel.classList.toggle("hidden", !connected || !snapshot.game.started);
  el.logPanel.classList.toggle("hidden", !connected || !snapshot.game.started);

  if (!snapshot) return;
  renderRoster(snapshot);
  renderSetup(snapshot);
  if (snapshot.game.started) {
    renderGame(snapshot);
    renderLogs(snapshot);
  }
}

function collectCharacters() {
  return {
    Parliament: state.setupDraft.Parliament || document.getElementById("setup-Parliament").value,
    Base: state.setupDraft.Base || document.getElementById("setup-Base").value,
    Office: state.setupDraft.Office || document.getElementById("setup-Office").value,
  };
}

function collectSubmission() {
  const decisionType = state.turnDraft?.decision?.type || document.getElementById("decision-type")?.value || "";
  const decisionTargetValue =
    decisionType === "Priority Target"
      ? document.getElementById("decision-target")?.value
      : decisionType === "Leader's Intervention"
        ? document.getElementById("decision-target-intervention")?.value
        : decisionType === "Full Exposure"
          ? document.getElementById("decision-target-exposure")?.value
          : "";
  const decisionPayloadValue =
    decisionType === "Priority Target"
      ? document.getElementById("decision-payload")?.value
      : decisionType === "Leader's Intervention"
        ? document.getElementById("decision-action")?.value
        : "";
  const decision = decisionType
    ? {
        type: decisionType,
        targetSeat: optionalNumber(state.turnDraft?.decision?.targetSeat ?? decisionTargetValue),
        payload: (state.turnDraft?.decision?.payload ?? decisionPayloadValue) || "",
        guess: ["Parliament", "Base", "Office"].map((tower) => (state.turnDraft?.decision?.guesses?.[tower] ?? document.getElementById(`fe-${tower}`)?.value) || ""),
      }
    : null;

  const treatyTarget = optionalNumber(state.turnDraft?.treaty?.targetSeat ?? document.getElementById("treaty-target")?.value);
  const treaty = treatyTarget === null ? null : {
    targetSeat: treatyTarget,
    duration: Number(state.turnDraft?.treaty?.duration ?? document.getElementById("treaty-duration").value),
  };

  const treatyResponses = Array.from(document.querySelectorAll(".treaty-response-select"))
    .map((select) => ({
      offerId: Number(select.dataset.offerId),
      response: state.turnDraft?.treatyResponses?.[select.dataset.offerId] ?? select.value,
    }))
    .filter((entry) => entry.response);

  const actions = [];
  for (let index = 0; index < 8; index += 1) {
    const actionDraft = state.turnDraft?.actions?.[index] || null;
    const type = actionDraft?.type || document.getElementById(`action-type-${index}`)?.value || "";
    if (!type) continue;
    if (type === "Distributed Assault") {
      const targets = [];
      for (let dist = 0; dist < 3; dist += 1) {
        const distDraft = actionDraft?.targets?.[dist] || null;
        const targetSeat = optionalNumber(distDraft?.targetSeat ?? document.getElementById(`dist-target-${index}-${dist}`)?.value);
        const targetTower = (distDraft?.targetTower ?? document.getElementById(`dist-tower-${index}-${dist}`)?.value) || "";
        const guess = (distDraft?.guess ?? document.getElementById(`dist-guess-${index}-${dist}`)?.value) || "";
        if (targetSeat !== null && targetTower) {
          targets.push({ targetSeat, targetTower, guess });
        }
      }
      actions.push({ type, targets });
      continue;
    }
    actions.push({
      type,
      targetSeat: optionalNumber(actionDraft?.targetSeat ?? document.getElementById(`action-target-${index}`)?.value),
      targetTower: (actionDraft?.targetTower ?? document.getElementById(`action-tower-${index}`)?.value) || "",
      guess: (actionDraft?.guess ?? document.getElementById(`action-guess-${index}`)?.value) || "",
    });
  }

  return { decision, treaty, treatyResponses, actions };
}

function optionalNumber(value) {
  return value === "" || value == null ? null : Number(value);
}

async function createLobby() {
  const payload = await api("/api/lobbies", {
    method: "POST",
    body: {
      displayName: el.createName.value.trim(),
      playerCount: Number(el.createSize.value),
    },
  });
  state.lobbyId = payload.lobbyId;
  state.token = payload.token;
  saveSession();
  history.replaceState({}, "", `/?lobby=${payload.lobbyId}`);
  beginPolling();
  await refreshState();
}

async function joinLobby() {
  const lobbyId = (el.joinCode.value || new URLSearchParams(window.location.search).get("lobby") || "").trim().toUpperCase();
  const payload = await api(`/api/lobbies/${encodeURIComponent(lobbyId)}/join`, {
    method: "POST",
    body: { displayName: el.joinName.value.trim() },
  });
  state.lobbyId = payload.lobbyId;
  state.token = payload.token;
  saveSession();
  history.replaceState({}, "", `/?lobby=${payload.lobbyId}`);
  beginPolling();
  await refreshState();
}

async function readyUp() {
  await api("/api/setup", {
    method: "POST",
    body: {
      lobbyId: state.lobbyId,
      token: state.token,
      characters: collectCharacters(),
    },
  });
  state.setupDraft = {
    Parliament: "",
    Base: "",
    Office: "",
  };
  await refreshState();
}

async function submitTurn() {
  await api("/api/submit", {
    method: "POST",
    body: {
      lobbyId: state.lobbyId,
      token: state.token,
      submission: collectSubmission(),
    },
  });
  state.turnDraft = null;
  window.alert("Turn submitted successfully.");
  await refreshState();
}

function createEmptyTurnDraft(snapshot) {
  return {
    day: snapshot.game.displayDay,
    treaty: { targetSeat: "", duration: "2" },
    treatyResponses: {},
    decision: {
      type: "",
      targetSeat: "",
      payload: "",
      guesses: { Parliament: "", Base: "", Office: "" },
    },
    actions: Array.from({ length: 8 }, () => ({
      type: "",
      targetSeat: "",
      targetTower: "",
      guess: "",
      targets: Array.from({ length: 3 }, () => ({
        targetSeat: "",
        targetTower: "",
        guess: "",
      })),
    })),
  };
}

function hydrateTurnDraft(snapshot) {
  const draft = state.turnDraft;
  document.getElementById("treaty-target").value = draft.treaty.targetSeat;
  document.getElementById("treaty-duration").value = draft.treaty.duration;
  document.getElementById("decision-type").value = draft.decision.type;
  if (document.getElementById("decision-target")) {
    document.getElementById("decision-target").value = draft.decision.targetSeat;
  }
  if (document.getElementById("decision-payload")) {
    document.getElementById("decision-payload").value = draft.decision.payload;
  }
  if (document.getElementById("decision-target-intervention")) {
    document.getElementById("decision-target-intervention").value = draft.decision.targetSeat;
  }
  if (document.getElementById("decision-action")) {
    document.getElementById("decision-action").value = draft.decision.payload;
  }
  if (document.getElementById("decision-target-exposure")) {
    document.getElementById("decision-target-exposure").value = draft.decision.targetSeat;
  }
  snapshot.constants.towers.forEach((tower) => {
    document.getElementById(`fe-${tower}`).value = draft.decision.guesses[tower];
  });
  document.querySelectorAll(".treaty-response-select").forEach((select) => {
    select.value = draft.treatyResponses[select.dataset.offerId] || "";
  });
  for (let index = 0; index < 8; index += 1) {
    const action = draft.actions[index];
    document.getElementById(`action-type-${index}`).value = action.type;
    document.getElementById(`action-target-${index}`).value = action.targetSeat;
    document.getElementById(`action-tower-${index}`).value = action.targetTower;
    document.getElementById(`action-guess-${index}`).value = action.guess;
    for (let dist = 0; dist < 3; dist += 1) {
      document.getElementById(`dist-target-${index}-${dist}`).value = action.targets[dist].targetSeat;
      document.getElementById(`dist-tower-${index}-${dist}`).value = action.targets[dist].targetTower;
      document.getElementById(`dist-guess-${index}-${dist}`).value = action.targets[dist].guess;
    }
    updateActionVisibility(index);
  }
  updateDecisionVisibility();
}

function bindTurnDraftEvents(snapshot) {
  const draft = state.turnDraft;
  document.getElementById("treaty-target").addEventListener("change", (event) => {
    draft.treaty.targetSeat = event.target.value;
  });
  document.getElementById("treaty-duration").addEventListener("change", (event) => {
    draft.treaty.duration = event.target.value;
  });
  document.querySelectorAll(".treaty-response-select").forEach((select) => {
    select.addEventListener("change", (event) => {
      draft.treatyResponses[event.target.dataset.offerId] = event.target.value;
    });
  });
  document.getElementById("decision-type").addEventListener("change", (event) => {
    draft.decision.type = event.target.value;
    updateDecisionVisibility();
  });
  const priorityTarget = document.getElementById("decision-target");
  const priorityPayload = document.getElementById("decision-payload");
  const interventionTarget = document.getElementById("decision-target-intervention");
  const interventionAction = document.getElementById("decision-action");
  const exposureTarget = document.getElementById("decision-target-exposure");
  if (priorityTarget) priorityTarget.addEventListener("change", (event) => { draft.decision.targetSeat = event.target.value; });
  if (priorityPayload) priorityPayload.addEventListener("change", (event) => { draft.decision.payload = event.target.value; });
  if (interventionTarget) interventionTarget.addEventListener("change", (event) => { draft.decision.targetSeat = event.target.value; });
  if (interventionAction) interventionAction.addEventListener("change", (event) => { draft.decision.payload = event.target.value; });
  if (exposureTarget) exposureTarget.addEventListener("change", (event) => { draft.decision.targetSeat = event.target.value; });
  snapshot.constants.towers.forEach((tower) => {
    document.getElementById(`fe-${tower}`).addEventListener("change", (event) => {
      draft.decision.guesses[tower] = event.target.value;
    });
  });
  for (let index = 0; index < 8; index += 1) {
    document.getElementById(`action-type-${index}`).addEventListener("change", (event) => {
      draft.actions[index].type = event.target.value;
      updateActionVisibility(index);
    });
    document.getElementById(`action-target-${index}`).addEventListener("change", (event) => {
      draft.actions[index].targetSeat = event.target.value;
    });
    document.getElementById(`action-tower-${index}`).addEventListener("change", (event) => {
      draft.actions[index].targetTower = event.target.value;
    });
    document.getElementById(`action-guess-${index}`).addEventListener("change", (event) => {
      draft.actions[index].guess = event.target.value;
    });
    for (let dist = 0; dist < 3; dist += 1) {
      document.getElementById(`dist-target-${index}-${dist}`).addEventListener("change", (event) => {
        draft.actions[index].targets[dist].targetSeat = event.target.value;
      });
      document.getElementById(`dist-tower-${index}-${dist}`).addEventListener("change", (event) => {
        draft.actions[index].targets[dist].targetTower = event.target.value;
      });
      document.getElementById(`dist-guess-${index}-${dist}`).addEventListener("change", (event) => {
        draft.actions[index].targets[dist].guess = event.target.value;
      });
    }
  }
}

function updateDecisionVisibility() {
  const type = document.getElementById("decision-type")?.value || "";
  const details = document.getElementById("decision-details");
  const priority = document.getElementById("decision-priority-wrap");
  const intervention = document.getElementById("decision-intervention-wrap");
  const exposure = document.getElementById("decision-exposure-wrap");
  if (!details) return;
  details.classList.toggle("hidden", !["Priority Target", "Leader's Intervention", "Full Exposure"].includes(type));
  priority.classList.toggle("hidden", type !== "Priority Target");
  intervention.classList.toggle("hidden", type !== "Leader's Intervention");
  exposure.classList.toggle("hidden", type !== "Full Exposure");
}

function updateActionVisibility(index) {
  const type = document.getElementById(`action-type-${index}`)?.value || "";
  const targetLabel = document.getElementById(`action-target-label-${index}`);
  const targetSelect = document.getElementById(`action-target-${index}`);
  const towerLabel = document.getElementById(`action-tower-label-${index}`);
  const towerSelect = document.getElementById(`action-tower-${index}`);
  const guessWrap = document.getElementById(`action-guess-wrap-${index}`);
  const distributedWrap = document.getElementById(`distributed-wrap-${index}`);

  const needsNation = ["Strike", "Target Strike", "Siege Operation", "Coordinated Assault", "Deep Surveillance", "Identity Check", "Move Check", "Interception"].includes(type);
  const needsTower = ["Strike", "Target Strike", "Siege Operation", "Coordinated Assault", "Fortify", "Repair", "Evacuation", "Sabotage", "Deep Surveillance"].includes(type);
  const needsGuess = ["Target Strike", "Siege Operation", "Identity Check"].includes(type);
  const isDistributed = type === "Distributed Assault";

  targetLabel.classList.toggle("hidden", !needsNation);
  targetSelect.classList.toggle("hidden", !needsNation);
  towerLabel.classList.toggle("hidden", !needsTower);
  towerSelect.classList.toggle("hidden", !needsTower);
  guessWrap.classList.toggle("hidden", !needsGuess);
  distributedWrap.classList.toggle("hidden", !isDistributed);
}

function interactionShouldPauseRendering(target) {
  return Boolean(target && target.closest && target.closest("#setup-grid, #player-form"));
}

document.addEventListener("focusin", (event) => {
  if (interactionShouldPauseRendering(event.target)) {
    state.suppressRenderWhileEditing = true;
  }
});

document.addEventListener("focusout", () => {
  window.setTimeout(() => {
    const active = document.activeElement;
    if (interactionShouldPauseRendering(active)) {
      return;
    }
    state.suppressRenderWhileEditing = false;
    if (state.pendingSnapshot) {
      applySnapshot(state.pendingSnapshot);
    }
  }, 0);
});

function renderMoveGuide() {
  el.moveGuideContent.innerHTML = Object.entries(moveDescriptions)
    .map(([move, description]) => `
      <div class="subtle-box">
        <strong>${move}</strong>
        <p class="meta-text">${description}</p>
      </div>
    `)
    .join("");
}

function openMoveGuide() {
  el.moveGuideModal.classList.remove("hidden");
}

function closeMoveGuide() {
  el.moveGuideModal.classList.add("hidden");
}

el.createLobbyButton.addEventListener("click", () => createLobby().catch((error) => window.alert(error.message)));
el.joinLobbyButton.addEventListener("click", () => joinLobby().catch((error) => window.alert(error.message)));
el.readyButton.addEventListener("click", () => readyUp().catch((error) => window.alert(error.message)));
el.submitTurnButton.addEventListener("click", () => submitTurn().catch((error) => window.alert(error.message)));
el.copyLinkButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(state.inviteLink);
});
el.moveGuideButton.addEventListener("click", openMoveGuide);
el.moveGuideClose.addEventListener("click", closeMoveGuide);
el.moveGuideDismiss.addEventListener("click", closeMoveGuide);

renderMoveGuide();
loadSession();
if (state.lobbyId && state.token) {
  beginPolling();
  refreshState();
} else if (new URLSearchParams(window.location.search).get("lobby")) {
  el.joinCode.value = new URLSearchParams(window.location.search).get("lobby");
}
