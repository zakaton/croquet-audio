class Model extends Croquet.Model {
    init() {
        this.x = {hey : "world"};
        this.subscribe(this.sessionId, "signal", this.signal);
        this.subscribe(this.sessionId, "deviceorientation", this.deviceorientation);
        this.subscribe(this.sessionId, "set-gain", this.setGain);
    }

    signal({viewId, data, timestamp}) {
        this.publish(this.sessionId, "signal", {viewId, data, timestamp});
    }

    deviceorientation({viewId, alpha, beta, gamma}) {
        this.publish(this.sessionId, "deviceorientation", {viewId, alpha, beta, gamma});
    }

    setGain({viewId, gain}) {
        this.publish(this.sessionId, "set-gain", {viewId, gain});
    }
}

Model.register();