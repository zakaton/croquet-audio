// AUDIO

const audioContext = new AudioContext();
const audioScene = new ResonanceAudio(audioContext, {
    ambisonicOrder : 3,
    dimensions : {
        width: 10, height: 7, depth: 10,
    },
    materials : {
        left: 'uniform', right: 'uniform',
        front: 'uniform', back: 'uniform',
        up: 'uniform', down: 'uniform',
    },
});

audioScene.output.connect(audioContext.destination);


window.addEventListener("click", event => {
    if(audioContext.state !== "running")
        audioContext.resume();
});

var scene, camera, room, renderer, cameraLight, ceilingLight;
const order = "YXZ";
const cameraEuler = new THREE.Euler();
    cameraEuler.order = order;
const rotateSpeed = 1;
var previousTime = performance.now();

const boseScalar = {
    x : 1,
    y : 1,
    z : 1,
};

window.addEventListener("load", event => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, 1, 0.01, 100);
    camera.position.set(0, 0, 0);
    camera.rotation.order = order;

    room = new THREE.Mesh(
        new THREE.BoxGeometry(
            10, // width
            7, // height
            10, // depth
        ),
        new THREE.MeshPhongMaterial({
            side : THREE.BackSide,
        }),
    );

    scene.add(room);

    cameraLight = new THREE.PointLight(
        0xffffff,
        0.9,
        100,
    );
    cameraLight.position.copy(camera.position);
    scene.add(cameraLight);

    ceilingLight = new THREE.DirectionalLight(
        0xffffff,
        0.5,
    );
    ceilingLight.position.set(0, 1, 0);
    scene.add(ceilingLight);

    renderer = new THREE.WebGLRenderer({
        antialias : true,
    });
    const sceneContainer = document.getElementById("sceneContainer");
    sceneContainer.appendChild(renderer.domElement);

    function resize() {
        const width = sceneContainer.clientWidth;
        const height = sceneContainer.clientHeight;

        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    renderer.setAnimationLoop(function() {
        camera.rotation.x = (cameraEuler.x + (boseEuler.x * boseScalar.x));
        camera.rotation.y = (cameraEuler.y + (boseEuler.y * boseScalar.y));
        camera.rotation.z = (cameraEuler.z + (boseEuler.z * boseScalar.z));

        audioScene.setListenerFromMatrix(camera.matrixWorld);
        
        renderer.render(scene, camera);
    });
});



// BOSE AR

const boseEuler = new THREE.Euler();
const boseEulerOrigin = new THREE.Euler();
    boseEuler.order = boseEulerOrigin.order = order;

var boseAREnabled = false;
var resetBoseAROrientation = false;

const boseARDeviceElement = document.querySelector("bose-ar-device");
boseARDeviceElement.addEventListener("connect", event => {
    console.log("connect")
    boseARDeviceElement.addEventListener("doubleTap", event => {
        resetBoseAROrientation = true;

        if(!boseAREnabled) {
            boseARDeviceElement.boseARDevice.enableSensor("gameRotation", 20);
            enabled = true;
        }
    });

    boseARDeviceElement.addEventListener("headNod", event => {
        view.focus(true);
    });
    boseARDeviceElement.addEventListener("headShake", event => {
        view.focus(false);
    });

    boseARDeviceElement.addEventListener("gameRotation", event => {
        boseEuler.x = Number(boseARDeviceElement.getAttribute("gamerotationpitch")) + (Math.PI/2);
        boseEuler.y = -Number(boseARDeviceElement.getAttribute("gamerotationyaw"));
        boseEuler.z = Number(boseARDeviceElement.getAttribute("gamerotationroll"));
        
        if(resetBoseAROrientation) {
            boseEulerOrigin.copy(boseEuler);
            resetBoseAROrientation = false;
        }

        boseEuler.x -= boseEulerOrigin.x;
        boseEuler.y -= boseEulerOrigin.y;
        boseEuler.z -= boseEulerOrigin.z;
    });
});


// LEAP MOTION

const handMaterials = {
    bone : new THREE.MeshPhongMaterial({
        color : 0xffffff,
    }),
    left :  new THREE.MeshPhongMaterial({
        color : 0xffff00,
    }),
    right : new THREE.MeshPhongMaterial({
        color : 0xff0000,
    }),
};

const handGeometries = {
    palm : new THREE.SphereGeometry(13, 12, 12),
    joint : new THREE.SphereGeometry(8, 8, 8),
};

const addedHand = {
    left : false,
    right : false,
};

const leapMotionElement = document.querySelector("leap-motion");
const addHand = (hand) => {
    const skeleton = leapMotionElement.leapMotion.skeleton;

    {
        const sphere = new THREE.Mesh(handGeometries.palm, handMaterials[hand.type]);
        const bone = skeleton.getBoneByName(`${hand.type} wrist`);
        bone.add(sphere);
        sphere.position.z = -hand.wrist.distanceTo(hand.palm.position);
    }

    hand.fingers.forEach(finger => {
        finger.bones.forEach(bone => {
            const _bone = skeleton.getBoneByName(`${hand.type} ${finger.name} ${bone.name}`);

            if(![2, 3].includes(finger.type) || bone.type !== 0) {
                const sphere = new THREE.Mesh(new THREE.SphereGeometry(8, 8, 8), handMaterials[hand.type]);
                _bone.add(sphere);


                const cylinder = new THREE.Mesh(
                    new THREE.CylinderGeometry(finger.width/3, finger.width/3, bone.length),
                    handMaterials.bone,
                );
                _bone.add(cylinder);
                
                cylinder.rotateX(Math.PI/2);
                cylinder.position.z = -bone.length/2;
            }
        });

        {
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(8, 8, 8), handMaterials[hand.type]);
            const bone = skeleton.getBoneByName(`${hand.type} ${finger.name} tip`);
            bone.add(sphere);
        }

        addedHand[hand.type] = true;
    });
}

const group = new THREE.Group();
group.scale.x = group.scale.y = group.scale.z = 0.005;

group.position.z = -0.6;
group.position.y = -1.7;

var skeleton;

leapMotionElement.addEventListener("open", event => {
    skeleton = leapMotionElement.leapMotion.skeleton;
    group.add(leapMotionElement.leapMotion.skeleton.bones[0])
    camera.add(group);
    scene.add(camera);

    const isVisible = {
        left : false,
        right : false,
    }

    const thumbTipPosition = {
        left : new THREE.Vector3(),
        right : new THREE.Vector3(),
    };

    const fingerTipPosition = {
        left : new THREE.Vector3(),
        right : new THREE.Vector3(),
    };

    const midpoint = new THREE.Vector3();

    leapMotionElement.addEventListener("frame", event => {
        const frame = event.detail;

        isVisible.left = isVisible.right = false;

        frame.hands.filter(hand => hand.type == "left").forEach(hand => {
            if(!addedHand[hand.type])
                addHand(hand);

            isVisible[hand.type] = true;

            skeleton.getBoneByName(`${hand.type} thumb tip`).getWorldPosition(thumbTipPosition[hand.type])
            
            if(hand.pinch.strength > 0.5) {
                scene.children.filter(mesh => mesh.name.includes("view-id")).some(mesh => {
                    if(mesh.position.distanceTo(thumbTipPosition[hand.type]) < 0.2) {
                        skeleton.getBoneByName(`${hand.type} index tip`).getWorldPosition(fingerTipPosition[hand.type])
                        midpoint.set(0, 0, 0);
                        midpoint.add(fingerTipPosition[hand.type]);
                        midpoint.add(thumbTipPosition[hand.type]);
                        midpoint.multiplyScalar(0.5);
                        mesh.position.copy(midpoint);
                        return true;
                    }
                });
            }
        });

        ["left", "right"].forEach(side => {
            if(!isVisible[side]) {
                // hide hand
            }
        });
    });
});
