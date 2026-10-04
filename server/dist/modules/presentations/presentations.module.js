"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresentationsModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const presentations_controller_1 = require("./presentations.controller");
const slides_controller_1 = require("./slides.controller");
const polls_controller_1 = require("./polls.controller");
const presentations_service_1 = require("./presentations.service");
const slides_service_1 = require("./slides.service");
const polls_service_1 = require("./polls.service");
const converter_service_1 = require("./converter.service");
const conversion_processor_1 = require("./conversion.processor");
const portable_service_1 = require("./portable.service");
const conversion_constants_1 = require("./conversion.constants");
let PresentationsModule = class PresentationsModule {
};
exports.PresentationsModule = PresentationsModule;
exports.PresentationsModule = PresentationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.registerQueue({
                name: conversion_constants_1.CONVERSION_QUEUE,
                defaultJobOptions: {
                    attempts: 2,
                    backoff: { type: 'exponential', delay: 5000 },
                    removeOnComplete: 200,
                    removeOnFail: 500,
                },
            }),
        ],
        controllers: [presentations_controller_1.PresentationsController, slides_controller_1.SlidesController, polls_controller_1.PollsController],
        providers: [
            presentations_service_1.PresentationsService,
            slides_service_1.SlidesService,
            polls_service_1.PollsService,
            converter_service_1.ConverterService,
            conversion_processor_1.ConversionProcessor,
            portable_service_1.PortableService,
        ],
        exports: [presentations_service_1.PresentationsService],
    })
], PresentationsModule);
//# sourceMappingURL=presentations.module.js.map