function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

class HostView extends Croquet.View {
    constructor(model) {
        super(model);
        this.model = model;

        window.view = this;

        this.joined = Date.now();

        this.views = {
            // viewId : {SimplePeer, mesh, stream, etc}
        };
        
        this.color = getRandomColor();

        this.subscribe(this.sessionId, "signal", this.signal);
        this.subscribe(this.sessionId, "view-exit", this.viewExit);
        this.subscribe(this.sessionId, "deviceorientation", this.deviceorientation);
        this.subscribe(this.sessionId, "gain", this.setGain);

        this.focused = false;

        navigator.mediaDevices.getUserMedia({
            audio : true,
            video : false,
        }).then(stream => {
            this.stream = stream;
            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.addEventListener("dataavailable", event => {
                const {data} = event;

                const audioElement = document.createElement("audio");
                audioElement.src = URL.createObjectURL(data);

                const track = document.createElement("div");
                tracks.appendChild(track);
                track.className = "track";

                peaks.init({
                    containers : {
                        overview: track,
                    },
                    mediaElement : audioElement,
                    webAudio : {
                        audioContext,
                    },
                    zoomLevels : [8],
                    overviewWaveformColor : this.color,
                }, (error, peaks) => {
                    this.peaks = peaks;
                });
            });
        });
        
        record.addEventListener("click", event => {
            record.disabled = true;
            stopRecording.disabled = false;

            this.mediaRecorder.start();
            for(let viewId in this.views) {
                const {mediaRecorder} = this.views[viewId];
                if(mediaRecorder !== undefined) {
                    mediaRecorder.start();
                }
            }

            stopRecording.addEventListener("click", event => {
                record.disabled = false;
                stopRecording.disabled = true;
                playRecording.disabled = false;

                this.mediaRecorder.stop();
                for(let viewId in this.views) {
                    const {mediaRecorder} = this.views[viewId];
                    if(mediaRecorder !== undefined) {
                        mediaRecorder.stop();
                    }
                }
            });
        });

        playRecording.addEventListener("click", event => {
            this.peaks.player.play();
            for(let viewId in this.views) {
                const {peaks} = this.views[viewId];
                if(peaks !== undefined) {
                    peaks.player.play();
                }
            }
        });
    }

    focus(focused) {
        if(this.focused !== focused) {
            this.focused = focused;
    
            if(this.focused) {
                const vector = new THREE.Vector3();
                var closestMesh;
                var closestMeshPosition;
                
                for(let viewId in this.views) {
                    const {mesh} = this.views[viewId];
                    if(mesh !== undefined) {
                        vector.copy(mesh.position);
                        vector.project(camera);
                        vector.z = 0;

                        if(closestMesh !== undefined) {
                            if((vector.length() < closestMeshPosition.length())) {
                                closestMeshPosition = vector;
                                closestMesh = mesh;
                            }
                        }
                        else {
                            closestMesh = mesh;
                            closestMeshPosition = vector;
                        }
                    }
                }

                for(let viewId in this.views) {
                    const {mesh} = this.views[viewId];
                    if(mesh !== undefined) {
                        mesh._gain = this.views[viewId].gain.gain.value;
                        this.setGain({
                            viewId,
                            gain : (mesh == closestMesh)? 1.2:0.2,
                        });
                    }
                }
            }
            else {
                for(let viewId in this.views) {
                    const {mesh} = this.views[viewId];
                    if(mesh !== undefined) {
                        this.setGain({
                            viewId,
                            gain : mesh._gain,
                        });
                    }
                }
            }
        }
    }

    signal({viewId, data, timestamp}) {
        if(timestamp > this.joined && this.viewId !== viewId && this.views[viewId] == undefined && data.type == "offer") {
            console.log("received offer");
            
            const peer = new SimplePeer({
                trickle : false,
                initiator : false,
            });
            this.views[viewId] = {peer};

            peer.on("signal", data => {
                console.log("sending answer");
                this.publish(this.sessionId, "set-signal", {
                    data,
                    viewId,
                    timestamp : Date.now(),
                });
            });
            peer.signal(data);

            peer.on("connect", () => {
                console.log("connected");
            });

            peer.on("stream", stream => {
                console.log(`receiving audio stream from ${viewId}`);
                
                const meshSize = 0.2;
                const color = getRandomColor();
                const mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(meshSize, meshSize, meshSize),
                    new THREE.MeshPhongMaterial({
                        color,
                    }),
                );
                mesh.rotation.order = "YXZ";
                mesh.name = `view-id=${viewId}`;
                mesh.position.set(0, 0, -1);
                scene.add(mesh);
                
                const source = audioScene.createSource();

                const gain = audioContext.createGain();

                const audioElement = document.createElement("audio");
                    audioElement.srcObject = stream;
                    audioElement.play();
                    audioElement.muted = true;
                

                const mediaStreamSource = audioContext.createMediaStreamSource(stream);
                    mediaStreamSource.connect(gain).connect(source.input);
                
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.addEventListener("dataavailable", event => {
                    const {data} = event;

                    const audioElement = document.createElement("audio");
                    audioElement.src = URL.createObjectURL(data);

                    const track = document.createElement("div");
                    track.className = "track";
                    tracks.appendChild(track);

                    peaks.init({
                        containers : {
                            overview: track,
                        },
                        mediaElement : audioElement,
                        webAudio : {
                            audioContext,
                        },
                        zoomLevels : [8],
                        overviewWaveformColor : color,
                    }, (error, peaks) => {
                        this.views[viewId].peaks = peaks;
                    });
                });

                Object.assign(this.views[viewId], {color, mediaRecorder, source, gain, mediaStreamSource, audioElement, mesh, stream});
            });

            peer.on("close", () => {
                console.log("closed");
            });
        }
    }

    update() {
        for(let viewId in this.views) {
            const {mesh, source} = this.views[viewId];

            if(mesh !== undefined && source !== undefined) {
                source.setFromMatrix(mesh.modelViewMatrix);
            }
        }
    }

    deviceorientation({viewId, alpha, beta, gamma}) {
        if(this.views[viewId] !== undefined) {
            const {mesh} = this.views[viewId];
            if(mesh !== undefined) {
                mesh.rotation.y = 2*Math.PI * (alpha/360);
                mesh.rotation.x = 2*Math.PI * (beta/360);
                mesh.rotation.z = -2*Math.PI * (gamma/360);
            }
        }
    }

    viewExit(viewId) {
        if(this.views[viewId] !== undefined) {
            const mesh = this.views[viewId].mesh;
            if(mesh !== undefined) {
                console.log("removing", mesh);
                scene.remove(mesh);
            }
            delete this.views[viewId];
        }
    }

    setGain({viewId, gain}) {
        if(this.views[viewId] !== undefined && this.views[viewId].gain !== undefined) {
            this.views[viewId].gain.gain.value = gain;
            ['x', 'y', 'z'].forEach(component => {
                this.views[viewId].mesh.scale[component] = gain;
            });
        }
    }
}

class MicrophoneView extends Croquet.View {
    constructor(model) {
        super(model);
        this.model = model;

        this.joined = Date.now();

        window.addEventListener("deviceorientation", event => {
            const {alpha, beta, gamma} = event;
            this.deviceorientation = {
                alpha, beta, gamma
            };
        });

        this.gain = 1;
        this.gainChanged = false;

        gain.addEventListener("input", event => {
            this.gain = Number(event.target.value);
            this.gainChanged = true;
        });

        navigator.mediaDevices.getUserMedia({
            audio : true,
            video : false,
        }).then(stream => {
            this.peer = new SimplePeer({
                initiator : true,
                trickle : false,
                stream
            });

            this.answered = false;

            this.peer.on("signal", data => {
                console.log("sending offer");
                this.publish(this.sessionId, "set-signal", {
                    viewId : this.viewId,
                    data,
                    timestamp : Date.now(),
                });
            });

            this.subscribe(this.sessionId, "signal", this.signal);

            this.peer.on("connect", () => this.connect());

            this.peer.on("close", () => {
                console.log("close");
            });


        }).catch(error => {
            window.alert(error);
        });
    }

    signal({viewId, data, timestamp}) {
        if(!this.answered && timestamp > this.joined && viewId == this.viewId && data.type == "answer") {
            console.log("receiving answer");
            this.answered = true;
            this.peer.signal(data);
        }
    }

    connect() {
        console.log("connected");
        this.connected = true;
    }

    update() {
        if(this.connected) {
            const {alpha, beta, gamma} = this.deviceorientation;
            
            if(Math.random() < 0.3)
                this.publish(this.sessionId, "set-deviceorientation", {
                    viewId : this.viewId,
                    alpha, beta, gamma,
                });

            if(this.gainChanged) {
                this.gainChanged = false;
                this.publish(this.sessionId, "set-gain", {
                    viewId : this.viewId,
                    gain : this.gain,
                });
            }
        }
    }
}