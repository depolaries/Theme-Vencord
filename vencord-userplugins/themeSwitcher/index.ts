/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 sunl3ss
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    ApplicationCommandInputType,
    ApplicationCommandOptionType,
    findOption,
    sendBotMessage
} from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { showToast, Toasts } from "@webpack/common";

const Native = VencordNative.pluginHelpers.ThemeSwitcher as PluginNative<typeof import("./native")>;

const presets = ["black", "gothic", "green", "purple", "red"] as const;
type Preset = typeof presets[number];

function isPreset(value: string): value is Preset {
    return presets.includes(value.toLowerCase() as Preset);
}

function displayName(preset: Preset) {
    return preset[0].toUpperCase() + preset.slice(1);
}

async function applyPreset(preset: Preset, notify = true) {
    try {
        await Native.applyPreset(preset);
        if (notify) showToast(`Theme: ${displayName(preset)}`, Toasts.Type.SUCCESS);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast(`Theme switch failed: ${message}`, Toasts.Type.FAILURE);
        throw error;
    }
}

const settings = definePluginSettings({
    preset: {
        type: OptionType.SELECT,
        description: "Active MyTheme preset",
        options: presets.map(preset => ({
            label: displayName(preset),
            value: preset,
            default: preset === "green"
        })),
        onChange: value => void applyPreset(value as Preset)
    }
});

function selectPreset(preset: Preset) {
    settings.store.preset = preset;
    void applyPreset(preset);
}

export default definePlugin({
    name: "ThemeSwitcher",
    description: "Switch MyTheme presets from Vencord settings, Toolbox, or /vtheme.",
    tags: ["Appearance", "Utility"],
    authors: [{ name: "sunl3ss", id: 418774298287669248n }],
    settings,

    toolboxActions: Object.fromEntries(
        presets.map(preset => [`Theme: ${displayName(preset)}`, () => selectPreset(preset)])
    ),

    commands: [{
        name: "vtheme",
        description: "Switch the active MyTheme preset.",
        inputType: ApplicationCommandInputType.BUILT_IN,
        options: [{
            name: "preset",
            description: "black, gothic, green, purple, or red",
            required: true,
            type: ApplicationCommandOptionType.STRING
        }],
        execute: async (args, context) => {
            const value = findOption<string>(args, "preset", "").trim().toLowerCase();
            if (!isPreset(value)) {
                sendBotMessage(context.channel.id, {
                    content: `Unknown preset. Use: ${presets.join(", ")}.`
                });
                return;
            }

            settings.store.preset = value;
            await applyPreset(value);
            sendBotMessage(context.channel.id, {
                content: `Theme switched to **${displayName(value)}**.`
            });
        }
    }],

    start() {
        void applyPreset(settings.store.preset as Preset, false);
    }
});
