// J:/AI/Game/SRPG/src/utils/characterAssets.ts
// 캐릭터 이미지 URL 생성 유틸리티
// 파일 위치: public/assets/characters/{heroes|generics}/
//
// 영웅(Hero):  /assets/characters/heroes/{characterId}/{type}.png
// 일반 병사:   /assets/characters/generics/{unitType}_token.png

export type CharacterImageType = 'token' | 'bust' | 'full';

/**
 * 영웅 캐릭터 이미지 URL 생성
 * @param characterId - Character.id (e.g. 'char_001')
 * @param type - 'token' (256×256) | 'bust' (반신) | 'full' (전신)
 */
export function getCharacterImageUrl(
  characterId: string,
  type: CharacterImageType = 'token',
): string {
  if (!characterId) return '';
  return `/assets/characters/heroes/${characterId}/${type}.png`;
}

/**
 * 일반 병종 공용 토큰 이미지 URL 생성
 * @param unitType - UnitType 문자열 (e.g. 'INFANTRY')
 */
export function getGenericTokenUrl(unitType: string): string {
  return `/assets/characters/generics/${unitType.toLowerCase()}_token.png`;
}

/**
 * PIXI Texture 로드 시 에러 핸들링용 존재 여부 확인
 * (실제 fetch 없이 src set 후 onerror 폴백 방식 사용)
 */
export function resolveCharacterToken(
  characterId: string | undefined,
  unitType: string,
): string {
  // characterId 있으면 영웅 포트레이트, 없으면 병종 공용
  if (characterId) return getCharacterImageUrl(characterId, 'token');
  return getGenericTokenUrl(unitType);
}
