const { describe, it, expect } = require("vitest");
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

function setupTwoPlayerGame() {
  const lobby = createLobby("TEST01", "Host", 2);
  joinLobby(lobby, "Guest");
  setCharacters(lobby.game, 0, DEFAULT_ASSIGNMENTS);
  setCharacters(lobby.game, 1, ALT_ASSIGNMENTS);
  return lobby.game;
}

function resolveSubmittedDay(game, firstSubmission, secondSubmission) {
  submitTurn(game, 0, firstSubmission);
  submitTurn(game, 1, secondSubmission);
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
});
