import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';

// 感情データ: 名前、色、開始角度、終了角度
const emotions = [
  { name: '喜び', color: '#FFD700', startAngle: -22.5, endAngle: 22.5 },   // Gold
  { name: '信頼', color: '#90EE90', startAngle: 22.5, endAngle: 67.5 },    // LightGreen
  { name: '恐れ', color: '#2E8B57', startAngle: 67.5, endAngle: 112.5 },   // SeaGreen
  { name: '驚き', color: '#4682B4', startAngle: 112.5, endAngle: 157.5 },  // SteelBlue
  { name: '悲しみ', color: '#0000CD', startAngle: 157.5, endAngle: 202.5 }, // MediumBlue
  { name: '嫌悪', color: '#DA70D6', startAngle: 202.5, endAngle: 247.5 },  // Orchid
  { name: '怒り', color: '#DC143C', startAngle: 247.5, endAngle: 292.5 },  // Crimson
  { name: '期待', color: '#FFA500', startAngle: 292.5, endAngle: 337.5 },  // Orange
];

const neutralEmotion = { name: '中立', color: '#A9A9A9' }; // DarkGray

// 扇形のSVGパスを生成するヘルパー関数
const createArcPath = (x, y, radius, startAngle, endAngle) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  const d = [
    'M', x, y,
    'L', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    'Z',
  ].join(' ');
  return d;
};

// 角度と半径から座標を計算するヘルパー関数
const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

// EmotionWheel コンポーネント本体
const EmotionWheel = ({ onEmotionSelect }) => {
  const size = 300; // SVG全体のサイズ
  const center = size / 2;
  const outerRadius = size / 2;
  const innerRadius = size / 5; // 中央の円の半径

  return (
    <View style={styles.container}>
      <Svg height={size} width={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 8つの感情の扇形を描画 */}
        {emotions.map((emotion) => (
          <Path
            key={emotion.name}
            d={createArcPath(center, center, outerRadius, emotion.startAngle, emotion.endAngle)}
            fill={emotion.color}
            onPress={() => onEmotionSelect(emotion.name)}
          />
        ))}

        {/* 中央の「中立」の円を描画 */}
        <Circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill={neutralEmotion.color}
          onPress={() => onEmotionSelect(neutralEmotion.name)}
        />

        {/* 中央の円のテキスト */}
        <SvgText
          x={center}
          y={center}
          fill="white"
          fontSize="20"
          fontWeight="bold"
          textAnchor="middle"
          alignmentBaseline="central"
          onPress={() => onEmotionSelect(neutralEmotion.name)} // テキストをタップしても反応するように
        >
          {neutralEmotion.name}
        </SvgText>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default EmotionWheel;