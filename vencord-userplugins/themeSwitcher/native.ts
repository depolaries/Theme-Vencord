/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 sunl3ss
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, IpcMainInvokeEvent } from "electron";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

const dataDirectory = process.env.VENCORD_USER_DATA_DIR ?? (
    process.env.DISCORD_USER_DATA_DIR
        ? join(process.env.DISCORD_USER_DATA_DIR, "..", "VencordData")
        : join(app.getPath("userData"), "..", "Vencord")
);

const themeDirectory = join(dataDirectory, "themes");
const activeThemePath = join(themeDirectory, "MyTheme-Active.css");
const statePath = join(themeDirectory, ".vtheme-current");

const presetFiles = {
    black: "MyTheme-Black.css",
    gothic: "MyTheme-Gothic.css",
    green: "MyTheme-Green.css",
    purple: "MyTheme-Purple.css",
    red: "MyTheme-Red.css"
} as const;

type Preset = keyof typeof presetFiles;

function isPreset(value: string): value is Preset {
    return Object.hasOwn(presetFiles, value);
}

export async function applyPreset(_: IpcMainInvokeEvent, requestedPreset: string) {
    const preset = requestedPreset.toLowerCase();
    if (!isPreset(preset)) throw new Error(`Unknown preset: ${requestedPreset}`);

    await mkdir(themeDirectory, { recursive: true });

    const sourcePath = join(themeDirectory, presetFiles[preset]);
    let content = await readFile(sourcePath, "utf8");
    const displayName = preset[0].toUpperCase() + preset.slice(1);

    content = content
        .replace(/^ \* @name .+$/m, ` * @name MyTheme Active - ${displayName}`)
        .replace(
            /^ \* @description .+$/m,
            ` * @description Managed by ThemeSwitcher. Current preset: ${displayName}.`
        );

    await Promise.all([
        writeFile(activeThemePath, content, "utf8"),
        writeFile(statePath, `${preset}\n`, "utf8")
    ]);

    return preset;
}
