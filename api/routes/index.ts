// รวม router ทั้งหมดของ /api
import { Router } from "express";
import pull from "./pull";
import schedules from "./schedules";
import data from "./data";
import fieldtest from "./fieldtest";
import windsor from "./windsor";
import apify from "./apify";
import img from "./img";
import auth from "./auth";

const api = Router();

api.use(pull);
api.use(schedules);
api.use(data);
api.use(fieldtest);
api.use(windsor);
api.use(apify);
api.use(img);
api.use(auth);

export default api;
