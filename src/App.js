import "./App.css";
import React, { useEffect, useRef, useState } from "react";
import { initNotifications, notify } from "@mycv/f8-notification";
import soundURL from "./assets/audio.mp3";
import { Howl } from "howler";
const tf = require("@tensorflow/tfjs");
const mobilenet = require("@tensorflow-models/mobilenet");
const knnClassifier = require("@tensorflow-models/knn-classifier");

var sound = new Howl({
    src: [soundURL],
});

const NOT_TOUCH_LABEL = "not_touch";
const TOUCH_LABEL = "touched";
const TRAINING_TIMES = 50;
const TOUCHED_CONFIDENCE = 0.8;

function App() {
    const video = useRef();
    const classifier = useRef();
    const canPlaySound = useRef(true);
    const mobilenetModule = useRef();
    const [touched, setTouched] = useState(false);

    const init = async () => {
        console.log("init...");
        await setupCamera();
        console.log("setup camera success");

        mobilenetModule.current = await mobilenet.load();

        classifier.current = knnClassifier.create();

        console.log("setup done");
        console.log("Khong cham tay len mat va bam train 1");

        initNotifications({ cooldown: 3000 });
    };

    const setupCamera = () => {
        return new Promise((resolve, reject) => {
            navigator.getUserMedia =
                navigator.getUserMedia ||
                navigator.webkitGetUserMedia ||
                navigator.mozGetUserMedia ||
                navigator.msGetUserMedia;

            if (navigator.getUserMedia) {
                navigator.getUserMedia(
                    {
                        video: true,
                    },
                    (stream) => {
                        video.current.srcObject = stream;
                        video.current.addEventListener("loadeddata", resolve);
                    },
                    (error) => reject(error)
                );
            } else {
                reject();
            }
        });
    };

    const train = async (label) => {
        console.log(`[${label}] dang train cho may mat dep trai cua ban`);
        for (let i = 0; i < TRAINING_TIMES; ++i) {
            console.log(
                `Progress ${parseInt(((i + 1) / TRAINING_TIMES) * 100)}%`
            );
            await training(label);
        }
    };

    /* 
    Buoc 1: Train cho may khuon mat khong cham tay
    Buoc 2: Train cho may khuon mat co cham tay
    Buoc 3: Lay hinh anh hien tai, phan tich va so sanh voi data da hoc truoc do
    ==> Neu ma matching voi data khuon mat cham tay => canh bao
    */

    const training = (label) => {
        return new Promise(async (resolve) => {
            const embedding = mobilenetModule.current.infer(
                video.current,
                true
            );
            classifier.current.addExample(embedding, label);
            await sleep(100);
            resolve();
        });
    };

    const run = async () => {
        const embedding = mobilenetModule.current.infer(video.current, true);
        const result = await classifier.current.predictClass(embedding);

        console.log("Label: ", result.label);
        console.log("Confidences: ", result.confidences);

        if (
            result.label === TOUCH_LABEL &&
            result.confidences[result.label] > TOUCHED_CONFIDENCE
        ) {
            console.log("Touched");
            if (canPlaySound.current) {
                canPlaySound.current = false;
                sound.play();
            }
            sound.play();
            notify("Bỏ tay ra", { body: "Bạn vừa chạm tay vào mặt" });
            setTouched(true);
        } else {
            console.log("Not touched");
            setTouched(false);
        }

        await sleep(200);

        run();
    };

    const sleep = (ms = 0) => {
        return new Promise((resolve) => setTimeout(resolve, ms));
    };

    useEffect(() => {
        init();

        sound.on("end", function () {
            canPlaySound.current = true;
        });

        //Cleanup
        return () => {};
    }, []);

    return (
        <div className={`main ${touched ? "touched" : ""}`}>
            <video ref={video} className="video" autoPlay />

            <div className="control">
                <button className="btn" onClick={() => train(NOT_TOUCH_LABEL)}>
                    Train 1
                </button>
                <button className="btn" onClick={() => train(TOUCH_LABEL)}>
                    Train 2
                </button>
                <button className="btn" onClick={() => run()}>
                    Run
                </button>
            </div>
        </div>
    );
}

export default App;
