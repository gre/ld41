import React, { Component } from "react";
import "./index.css";
if (typeof window !== "undefined") require("./game");

class Game extends Component {
  componentDidMount() {
    if (typeof window === "undefined");
    let gameModule = require("./game");
    let gameInst;
    if (module.hot) {
      module.hot.accept("./game", () => {
        gameModule = require("./game");
        if (gameInst) gameInst.destroy();
        gameInst = gameModule.default(this.ref);
      });
    }
    gameInst = gameModule.default(this.ref);
  }
  componentDidUpdate() {
    console.log("update");
  }
  onRef = ref => {
    this.ref = ref;
  };
  render() {
    return <div className="game" ref={this.onRef} />;
  }
}

export default () => <Game />;
