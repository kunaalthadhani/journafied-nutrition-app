import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Acid } from '../constants/acid';

// The bar covers the first of the two calls a photo costs: the model reading
// the plate. The second call, turning that reading into numbers, carries on in
// the log row after the handoff. So the bar is not decoration over an unknown
// wait, it is the first half of a real pipeline.
const HANDOFF_MS = 2800;
// Stops short of full on purpose. A bar that reaches 100 and then vanishes
// claims a finish that has not happened
const HANDOFF_PCT = 88;

const CAPTIONS: { at: number; text: string }[] = [
  { at: 0, text: 'Reading the photo' },
  { at: 1000, text: 'Finding the ingredients' },
  { at: 2000, text: 'Weighing the portions' },
];

interface PhotoAnalyzingOverlayProps {
  imageUri: string | null;
  onHandoff: () => void;
  /** Fired when the user tells us something the camera cannot see. */
  onNote: (note: string) => void;
}

export const PhotoAnalyzingOverlay: React.FC<PhotoAnalyzingOverlayProps> = ({ imageUri, onHandoff, onNote }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const [caption, setCaption] = useState(CAPTIONS[0].text);
  const [note, setNote] = useState('');
  const [typing, setTyping] = useState(false);
  const handoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visible = !!imageUri;

  useEffect(() => {
    if (!visible) return;

    progress.setValue(0);
    setCaption(CAPTIONS[0].text);
    setNote('');
    setTyping(false);

    Animated.timing(progress, {
      toValue: 1,
      duration: HANDOFF_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    const timers = CAPTIONS.slice(1).map(c => setTimeout(() => setCaption(c.text), c.at));
    // The analysis usually outlives the bar, so the bar hands the wait over to
    // the log row rather than holding the screen until an answer arrives
    handoffTimer.current = setTimeout(onHandoff, HANDOFF_MS);

    return () => {
      timers.forEach(clearTimeout);
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
    };
  }, [visible]);

  // Typing holds the screen. Without this the handoff fires at 2.8s and takes
  // the keyboard away mid sentence, which would make the field a trap rather
  // than an offer
  useEffect(() => {
    if (!typing) return;
    if (handoffTimer.current) { clearTimeout(handoffTimer.current); handoffTimer.current = null; }
    progress.stopAnimation();
  }, [typing]);

  const submitNote = () => {
    const trimmed = note.trim();
    setTyping(false);
    if (trimmed) onNote(trimmed);
    else onHandoff();
  };

  if (!visible) return null;

  // Back hands the wait over early. It never cancels the analysis, which is
  // already running and will land in the log either way
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onHandoff}>
      <KeyboardAvoidingView style={st.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Image source={{ uri: imageUri! }} style={st.shot} resizeMode="cover" />
        <View style={st.scrim} />

        <View style={st.panel}>
          <Text style={st.eyebrow}>ANALYSING</Text>
          <Text style={st.caption}>{caption}</Text>

          <View style={st.track}>
            <Animated.View
              style={[st.fill, {
                width: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', `${HANDOFF_PCT}%`],
                }),
              }]}
            />
          </View>

          {/* The camera cannot see what was left on the plate. This is the only
              channel for it, and it must stay optional: type nothing and the
              screen behaves exactly as it did before the field existed */}
          <TextInput
            style={[st.field, { borderColor: typing ? Acid.lime : Acid.hair2 }]}
            value={note}
            onChangeText={setNote}
            onFocus={() => setTyping(true)}
            placeholder="Only ate 2 slices? Tell me here"
            placeholderTextColor={Acid.tx3}
            selectionColor={Acid.lime}
            returnKeyType="done"
            onSubmitEditing={submitNote}
            maxLength={140}
          />

          {typing
            ? (
              <TouchableOpacity onPress={submitNote} style={st.cta} activeOpacity={0.7}>
                <Text style={st.ctaTxt}>{note.trim() ? 'USE THIS' : 'SKIP'}</Text>
              </TouchableOpacity>
            )
            : <Text style={st.note}>Optional. You can keep logging while this finishes.</Text>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Acid.mossDeep, justifyContent: 'flex-end' },
  shot: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,13,9,0.72)' },
  panel: { paddingHorizontal: 28, paddingBottom: 72 },
  eyebrow: { fontSize: 11, letterSpacing: 2.5, color: Acid.tx3, marginBottom: 12 },
  caption: { fontFamily: Acid.serif, fontSize: 28, lineHeight: 34, color: Acid.tx, marginBottom: 26 },
  track: { height: 3, borderRadius: 2, backgroundColor: Acid.hair, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2, backgroundColor: Acid.lime },
  note: { fontSize: 12, color: Acid.tx3, marginTop: 16 },
  field: {
    marginTop: 22, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: Acid.tx, backgroundColor: 'rgba(238,242,230,0.04)',
  },
  cta: { marginTop: 14, alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, backgroundColor: Acid.lime },
  ctaTxt: { fontSize: 11, letterSpacing: 1.5, color: Acid.moss },
});
