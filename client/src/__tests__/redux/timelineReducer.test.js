import timelineReducer from '../../reducers/timelineReducer';
import * as types from '../../actions/types';

describe('Timeline Reducer', () => {
    // Начальное состояние
    const initialState = {
        currentTime: 0,
        isPlaying: false,
        playbackSpeed: 1,
        selectedKeyframe: null,
        duration: 60
    };

    // Тест для проверки начального состояния
    it('должен вернуть начальное состояние', () => {
        expect(timelineReducer(undefined, {})).toEqual(initialState);
    });

    // Тест для SET_TIMELINE_CURRENT_TIME
    it('должен обработать SET_TIMELINE_CURRENT_TIME', () => {
        const time = 25;
        const action = {
            type: types.SET_TIMELINE_CURRENT_TIME,
            payload: time
        };

        const expectedState = {
            ...initialState,
            currentTime: time
        };

        expect(timelineReducer(initialState, action)).toEqual(expectedState);
    });

    // Тест для SET_TIMELINE_PLAYING
    it('должен обработать SET_TIMELINE_PLAYING', () => {
        const isPlaying = true;
        const action = {
            type: types.SET_TIMELINE_PLAYING,
            payload: isPlaying
        };

        const expectedState = {
            ...initialState,
            isPlaying
        };

        expect(timelineReducer(initialState, action)).toEqual(expectedState);
    });

    // Тест для SET_TIMELINE_PLAYBACK_SPEED
    it('должен обработать SET_TIMELINE_PLAYBACK_SPEED', () => {
        const speed = 2;
        const action = {
            type: types.SET_TIMELINE_PLAYBACK_SPEED,
            payload: speed
        };

        const expectedState = {
            ...initialState,
            playbackSpeed: speed
        };

        expect(timelineReducer(initialState, action)).toEqual(expectedState);
    });

    // Тест для SELECT_KEYFRAME
    it('должен обработать SELECT_KEYFRAME', () => {
        const keyframeId = 'keyframe1';
        const action = {
            type: types.SELECT_KEYFRAME,
            payload: keyframeId
        };

        const expectedState = {
            ...initialState,
            selectedKeyframe: keyframeId
        };

        expect(timelineReducer(initialState, action)).toEqual(expectedState);
    });

    // Тест для DESELECT_KEYFRAME
    it('должен обработать DESELECT_KEYFRAME', () => {
        // Создаем состояние с выбранным ключевым кадром
        const stateWithSelectedKeyframe = {
            ...initialState,
            selectedKeyframe: 'keyframe1'
        };

        const action = {
            type: types.DESELECT_KEYFRAME
        };

        const expectedState = {
            ...stateWithSelectedKeyframe,
            selectedKeyframe: null
        };

        expect(timelineReducer(stateWithSelectedKeyframe, action)).toEqual(expectedState);
    });

    // Тест для SET_TIMELINE_DURATION
    it('должен обработать SET_TIMELINE_DURATION', () => {
        const duration = 120;
        const action = {
            type: types.SET_TIMELINE_DURATION,
            payload: duration
        };

        const expectedState = {
            ...initialState,
            duration
        };

        expect(timelineReducer(initialState, action)).toEqual(expectedState);
    });

    // Тест для ADD_KEYFRAME
    it('должен обработать ADD_KEYFRAME при добавлении ключевого кадра', () => {
        // Предположим, что действие ADD_KEYFRAME передает новое состояние проекта с добавленным ключевым кадром
        const updatedProject = {
            _id: 'project1',
            name: 'Проект 1',
            timeline: {
                duration: 60,
                keyframes: [
                    {
                        id: 'keyframe1',
                        time: 15,
                        elements: []
                    }
                ]
            }
        };

        const action = {
            type: types.ADD_KEYFRAME,
            payload: updatedProject
        };

        // В данном случае редьюсер просто выбирает новый ключевой кадр
        const expectedState = {
            ...initialState,
            selectedKeyframe: 'keyframe1'
        };

        expect(timelineReducer(initialState, action)).toEqual(expectedState);
    });

    // Тест для UPDATE_KEYFRAME
    it('должен обработать UPDATE_KEYFRAME', () => {
        const updatedKeyframe = {
            id: 'keyframe1',
            time: 20, // Изменено время с 15 на 20
            elements: []
        };

        const action = {
            type: types.UPDATE_KEYFRAME,
            payload: updatedKeyframe
        };

        // Предположим, что редьюсер возвращает то же состояние, так как обновление происходит в projectReducer
        expect(timelineReducer(initialState, action)).toEqual(initialState);
    });

    // Тест для DELETE_KEYFRAME
    it('должен обработать DELETE_KEYFRAME', () => {
        const stateWithSelectedKeyframe = {
            ...initialState,
            selectedKeyframe: 'keyframe1'
        };

        const action = {
            type: types.DELETE_KEYFRAME,
            payload: 'keyframe1'
        };

        // Предположим, что после удаления ключевого кадра, выбранный ключевой кадр становится null
        const expectedState = {
            ...stateWithSelectedKeyframe,
            selectedKeyframe: null
        };

        expect(timelineReducer(stateWithSelectedKeyframe, action)).toEqual(expectedState);
    });

    // Тест для STOP_AT_END
    it('должен обработать STOP_AT_END', () => {
        const stateWhilePlaying = {
            ...initialState,
            isPlaying: true,
            currentTime: 59
        };

        const action = {
            type: types.STOP_AT_END
        };

        const expectedState = {
            ...stateWhilePlaying,
            isPlaying: false,
            currentTime: initialState.duration
        };

        expect(timelineReducer(stateWhilePlaying, action)).toEqual(expectedState);
    });

    // Тест для RESET_TIMELINE
    it('должен обработать RESET_TIMELINE', () => {
        const modifiedState = {
            currentTime: 30,
            isPlaying: true,
            playbackSpeed: 2,
            selectedKeyframe: 'keyframe1',
            duration: 120
        };

        const action = {
            type: types.RESET_TIMELINE
        };

        expect(timelineReducer(modifiedState, action)).toEqual(initialState);
    });
}); 