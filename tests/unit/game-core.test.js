const {
  createLobby,
  joinLobby,
  setCharacters,
  submitTurn,
  everyoneSubmitted,
  resolveDay,
} = require("../../game-core");

const DEFAULT_ASSIGNMENTS = {
  Parliament: "Aster",
  Base: "Bram",
  Office: "Cyra",
};

const ALT_ASSIGNMENTS = {
  Parliament: "Dorian",
  Base: "Eira",
  Office: "Fen",
};

const THIRD_ASSIGNMENTS = {
  Parliament: "Galen",
  Base: "Helia",
  Office: "Ivor",
};

function setupTwoPlayerGame() {
  const lobby = createLobby("TEST01", "Host", 2);
  joinLobby(lobby, "Guest");
  setCharacters(lobby.game, 0, DEFAULT_ASSIGNMENTS);
  setCharacters(lobby.game, 1, ALT_ASSIGNMENTS);
  return lobby.game;
}

function setupThreePlayerGame() {
  const lobby = createLobby("TEST01", "Host", 3);
  joinLobby(lobby, "Guest");
  joinLobby(lobby, "Third");
  setCharacters(lobby.game, 0, DEFAULT_ASSIGNMENTS);
  setCharacters(lobby.game, 1, ALT_ASSIGNMENTS);
  setCharacters(lobby.game, 2, THIRD_ASSIGNMENTS);
  return lobby.game;
}

function resolveSubmittedDay(game, ...submissions) {
  submissions.forEach((submission, seat) => {
    submitTurn(game, seat, submission);
  });
  expect(everyoneSubmitted(game)).toBe(true);
  resolveDay(game);
}

describe("game-core rules", () => {
  it("repair restores HP during the defense phase", () => {
    const game = setupTwoPlayerGame();
    game.players[0].towers.Parliament.hp = 130;

    resolveSubmittedDay(
      game,
      {
        actions: [{ type: "Repair", targetTower: "Parliament" }],
      },
      {
        actions: [],
      }
    );

    expect(game.players[0].towers.Parliament.hp).toBe(170);
    expect(game.players[0].resolutionHistory[1]).toContain("Repair: Successful on Parliament: +40 HP");
  });

  it("sabotage blocks a siege only on the resolving turn", () => {
    const game = setupTwoPlayerGame();

    resolveSubmittedDay(
      game,
      {
        actions: [{ type: "Siege Operation", targetSeat: 1, targetTower: "Base", guess: "Eira" }],
      },
      {
        actions: [],
      }
    );

    expect(game.pendingSieges).toHaveLength(1);
    expect(game.players[1].resolutionHistory[1]).toContain("War Day: Incoming siege prepared against Base");

    resolveSubmittedDay(
      game,
      {
        actions: [],
      },
      {
        actions: [{ type: "Sabotage", targetTower: "Base" }],
      }
    );

    expect(game.pendingSieges).toHaveLength(0);
    expect(game.players[1].towers.Base.hp).toBe(200);
    expect(game.players[1].resolutionHistory[2]).toContain("Sabotage: Successful on Base");
  });

  it("leader intervention only succeeds if the predicted move was used", () => {
    const game = setupTwoPlayerGame();

    resolveSubmittedDay(
      game,
      {
        decision: {
          type: "Leader's Intervention",
          targetSeat: 1,
          payload: "Strike",
        },
        actions: [],
      },
      {
        actions: [{ type: "Repair", targetTower: "Parliament" }],
      }
    );

    expect(
      game.players[0].resolutionHistory[1].some((entry) =>
        entry.includes("National Decision: Leader's Intervention - Failure:")
        && entry.includes("did not use Strike")
      )
    ).toBe(true);
  });

  it("splits day score evenly when both nations tie", () => {
    const game = setupTwoPlayerGame();

    resolveSubmittedDay(
      game,
      { actions: [] },
      { actions: [] }
    );

    expect(game.players[0].score).toBe(25);
    expect(game.players[1].score).toBe(25);
    expect(
      game.players[0].resolutionHistory[1].some((entry) => entry.includes("tied and split Day 1"))
    ).toBe(true);
  });

  it("creates a treaty after mutual acceptance and blocks attacks while active", () => {
    const game = setupThreePlayerGame();

    resolveSubmittedDay(
      game,
      {
        treaty: { targetSeat: 1, duration: 1 },
        actions: [],
      },
      {
        treaty: { targetSeat: 0, duration: 3 },
        actions: [],
      },
      {
        actions: [],
      },
    );

    resolveSubmittedDay(
      game,
      {
        treatyResponses: [{ offerId: 2, response: "accept" }],
        actions: [{ type: "Strike", targetSeat: 1, targetTower: "Parliament" }],
      },
      {
        treatyResponses: [{ offerId: 1, response: "accept" }],
        actions: [],
      },
      {
        actions: [],
      },
    );

    expect(game.players[1].towers.Parliament.hp).toBe(200);
    expect(game.treaties.some((treaty) => treaty.active && treaty.remaining === 2 && treaty.a === 0 && treaty.b === 1)).toBe(true);
    expect(
      game.players[0].resolutionHistory[2].some((entry) =>
        entry.includes("Strike: Failure")
        && entry.includes("Active treaty with this nation is now broken")
      )
    ).toBe(true);
  });

  it("counter blocks only the first incoming attack and reflects 60 damage", () => {
    const game = setupTwoPlayerGame();

    resolveSubmittedDay(
      game,
      {
        actions: [
          { type: "Strike", targetSeat: 1, targetTower: "Parliament" },
          { type: "Target Strike", targetSeat: 1, targetTower: "Parliament", guess: "Aster" },
        ],
      },
      {
        actions: [{ type: "Counter" }],
      }
    );

    expect(game.players[0].towers.Parliament.hp).toBe(140);
    expect(game.players[1].towers.Parliament.hp).toBe(160);
    expect(
      game.players[0].resolutionHistory[1].some((entry) => entry.includes("Strike: Failure") && entry.includes("Countered"))
    ).toBe(true);
    expect(
      game.players[0].resolutionHistory[1].some((entry) => entry.includes("Target Strike: Successful"))
    ).toBe(true);
  });

  it("distributed assault damages three different towers and rewards a correct guess", () => {
    const game = setupTwoPlayerGame();

    resolveSubmittedDay(
      game,
      {
        actions: [{
          type: "Distributed Assault",
          targets: [
            { targetSeat: 1, targetTower: "Parliament", guess: "Dorian" },
            { targetSeat: 1, targetTower: "Base", guess: "" },
            { targetSeat: 1, targetTower: "Office", guess: "" },
          ],
        }],
      },
      { actions: [] }
    );

    expect(game.players[1].towers.Parliament.hp).toBe(175);
    expect(game.players[1].towers.Base.hp).toBe(185);
    expect(game.players[1].towers.Office.hp).toBe(185);
    expect(
      game.players[0].resolutionHistory[1].some((entry) =>
        entry.includes("Distributed Assault:")
        && entry.includes("Parliament: 25 damage")
        && entry.includes("Base: 15 damage")
        && entry.includes("Office: 15 damage")
      )
    ).toBe(true);
  });

  it("full exposure grants gold once for a nation and does not pay again on reuse", () => {
    const game = setupTwoPlayerGame();
    const startingGold = game.players[0].gold;

    resolveSubmittedDay(
      game,
      {
        decision: {
          type: "Full Exposure",
          targetSeat: 1,
          guess: ["Dorian", "Eira", "Fen"],
        },
        actions: [],
      },
      { actions: [] }
    );

    const goldAfterFirst = game.players[0].gold;
    expect(goldAfterFirst).toBe(startingGold + 200 + 25 + 25 + 50 + 25);

    resolveSubmittedDay(
      game,
      {
        decision: {
          type: "Full Exposure",
          targetSeat: 1,
          guess: ["Dorian", "Eira", "Fen"],
        },
        actions: [],
      },
      { actions: [] }
    );

    const secondDayGain = game.players[0].gold - goldAfterFirst;
    expect(secondDayGain).toBe(125);
    expect(game.players[0].fullExposureUsed[1]).toBe(true);
  });
});
