// EmotionWheel.js
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics'; // ★ Haptics をインポート

// 感情データとヘルパー関数 (変更なし)
const emotions = [
  { name: '喜び', colors: ['#DED481', '#DECC33'] }, { name: '信頼', colors: ['#AED581', '#7CB342'] },
  { name: '恐れ', colors: ['#4DB6AC', '#00897B'] }, { name: '驚き', colors: ['#4FC3F7', '#039BE5'] },
  { name: '悲しみ', colors: ['#64B5F6', '#1E88E5'] }, { name: '嫌悪', colors: ['#BA68C8', '#9C27B0'] },
  { name: '怒り', colors: ['#E57373', '#D32F2F'] }, { name: '期待', colors: ['#FFB74D', '#FB8C00'] },
];
const neutralEmotion = { name: 'その他', colors: ['#B0B0B0', '#808080'] }; // ★ グラデーション用に色を配列に

const createArcPath = (x, y, radius, startAngle, endAngle) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  const d = ['M', x, y, 'L', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y, 'Z'].join(' ');
  return d;
};
const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const EmotionWheel = ({ onEmotionSelect }) => {
  const svgSize = 300; // ★ SVG全体のサイズを少し大きくしてはみ出し領域を確保
  const wheelRadius = 150; // 輪自体の半径は300x300のまま
  const center = svgSize / 2;
  const innerRadius = wheelRadius / 2.5;

  const [pressedEmotion, setPressedEmotion] = useState(null);

  const handlePressIn = (emotionName) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // ★ 触覚フィードバック
    setPressedEmotion(emotionName);
  };
  const handlePressOut = (emotionName) => {
    setPressedEmotion(null);
    onEmotionSelect(emotionName);
  };

  const emotionGradients = emotions.map((emotion) => (
    <LinearGradient
      key={`grad-${emotion.name}`}
      id={`gradient-${emotion.name}`}
      x1="0.5" y1="0" x2="0.5" y2="1"
    >
      <Stop offset="0" stopColor={emotion.colors[0]} />
      <Stop offset="1" stopColor={emotion.colors[1]} />
    </LinearGradient>
  ));

  return (
    <View style={styles.container}>
      <Svg height={svgSize} width={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        {/* ★★★ グラデーションの定義 ★★★ */}
        <Defs>
          <LinearGradient id="neutralGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={neutralEmotion.colors[0]} />
            <Stop offset="1" stopColor={neutralEmotion.colors[1]} />
          </LinearGradient>

          {emotionGradients}
        </Defs>

        {emotions.map((emotion, index) => {
          const angle = 45;
          const startAngle = index * angle - angle / 2;
          const endAngle = index * angle + angle / 2;
          
          const isPressed = pressedEmotion === emotion.name;

          // テキストの位置計算
          const midAngle = (startAngle + endAngle) / 2;
          const textRadius = innerRadius + (wheelRadius - innerRadius) / 2;
          const textPos = polarToCartesian(center, center, textRadius, midAngle);

          return (
            <React.Fragment key={emotion.name}>
              {/* 扇形 */}
              <Path
                d={createArcPath(center, center, wheelRadius, startAngle, endAngle)}
                fill={`url(#gradient-${emotion.name})`}
                onPressIn={() => handlePressIn(emotion.name)}
                onPressOut={() => handlePressOut(emotion.name)}
                opacity={isPressed ? 0.7 : 1.0}
              />
              {/* 扇形のテキスト */}
              <SvgText
                x={textPos.x}
                y={textPos.y}
                fill="white" // ★ 白文字に変更
                fontSize="24"  // ★ 20ptに変更
                fontWeight="bold"
                textAnchor="middle"
                alignmentBaseline="central"
                pointerEvents="none"
              >
                {emotion.name}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* 中央の「中立」の円 */}
        <Circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill="url(#neutralGradient)" // ★ グラデーションを適用
          onPressIn={() => handlePressIn(neutralEmotion.name)}
          onPressOut={() => handlePressOut(neutralEmotion.name)}
          // ★ タップ時のフィードバック
          opacity={pressedEmotion === neutralEmotion.name ? 0.7 : 1.0}
        />
        <SvgText
          x={center}
          y={center}
          fill="white"
          fontSize="24"
          fontWeight="bold"
          textAnchor="middle"
          alignmentBaseline="central"
          pointerEvents="none"
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