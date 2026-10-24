# Third-party assets

## Concrete 030 / ambientCG

- Source: https://ambientcg.com/view?id=Concrete030
- Download: https://ambientcg.com/get?file=Concrete030_1K-JPG.zip
- License: Creative Commons CC0 1.0 Universal.
- License reference: https://docs.ambientcg.com/license/
- Included maps: Color, NormalGL, AmbientOcclusion, Roughness, at 1024 resolution.
- Downloaded 2026-10-24. No account-only, ripped game or Asset Store assets are included.

## AfterBlackout UI font

- Derived by subsetting Noto Sans CJK SC Regular from https://github.com/notofonts/noto-cjk.
- Source file: Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf.
- License: SIL Open Font License 1.1; full text is in `Assets/Blackout/Resources/UI/OFL.txt`.
- Font family and PostScript names were changed to AfterBlackout UI / AfterBlackoutUI.
- The subset includes the current project UI and catalog characters; run the coverage verifier when adding text.

## Code and dependencies

Unity packages are referenced by version in Packages/manifest.json and are restored by Unity Package Manager. Unity Editor binaries and license files are not distributed in this repository.

Fallback meshes and synthesized sounds are authored in this project. The upgraded ArtSet references the licensed assets listed below; procedural fallbacks remain for missing optional slots.

## Pixelhouse Zombie

- Author: Pixelhouse team.
- Source: https://opengameart.org/content/zombie
- License: CC BY 3.0, https://creativecommons.org/licenses/by/3.0/
- Original notice is retained in Assets/Blackout/Art/Zombie/read first.txt.
- Included: walk.FBX, fury.FBX, dead.FBX, diffuse/specular/normal textures.
- Changes: scale and orientation correction, URP material conversion, loop/root-motion settings, animation state machine, runner/armored/brute variants. These adaptations do not imply endorsement by Pixelhouse.
- Public web credits: unity-game/credits.html, also linked from the game's page.

## M4A1 Assault Rifle

- Author/uploader: nisu / 3DModelsCC0.
- Source: https://opengameart.org/content/m4a1-assault-rifle
- License: CC0, as specified on the source page.
- Changes: normalization, first-person pose, PBR texture packing, optic and glove additions.

## Various Small Arms

- Author: Tabasco.
- Source: https://opengameart.org/content/various-small-arms-assault-rifles-sniper-pistol
- License: CC0; the author explicitly placed the assets in the public domain on 2023-12-15. Older CC BY 3.0 attribution is retained here as well.
- Included: converted AK-47 and M1911 meshes. Source blend files were converted to FBX with Blender 2.79b, with automatic script execution disabled.
- Changes: format conversion, URP materials, normalization and first-person attachment geometry.

## Additional ambientCG surfaces

- Asphalt012, Bricks052, MetalPlates006, Wood051.
- Sources: https://ambientcg.com/view?id=Asphalt012 , https://ambientcg.com/view?id=Bricks052 , https://ambientcg.com/view?id=MetalPlates006 , https://ambientcg.com/view?id=Wood051
- License: CC0 1.0, https://docs.ambientcg.com/license/
- Included: 1K color/normal/roughness and available metallic/AO maps. Roughness and metalness are packed into URP metallic/smoothness textures.

AWM-style chassis, forged knife meshes, beveled fittings and glove/sleeve geometry are authored in Tools/Author-Equipment.py and the Unity editor art builder. These are project-authored models, not branded game model extractions. No Blender or Unity editor binaries are included in the source or game packages.
