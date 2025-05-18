import * as types from '../actions/types';

const initialState = {
    currentTime: 0,
    isPlaying: false,
    playbackSpeed: 1,
    selectedKeyframe: null,
    duration: 60
};

const timelineReducer = (state = initialState, action) => {
    switch (action.type) {
        case types.SET_TIMELINE_CURRENT_TIME:
            return {
                ...state,
                currentTime: action.payload
            };

        case types.SET_TIMELINE_PLAYING:
            return {
                ...state,
                isPlaying: action.payload
            };

        case types.SET_TIMELINE_PLAYBACK_SPEED:
            return {
                ...state,
                playbackSpeed: action.payload
            };

        case types.SELECT_KEYFRAME:
            return {
                ...state,
                selectedKeyframe: action.payload
            };

        case types.DESELECT_KEYFRAME:
            return {
                ...state,
                selectedKeyframe: null
            };

        case types.SET_TIMELINE_DURATION:
            return {
                ...state,
                duration: action.payload
            };

        case types.ADD_KEYFRAME:
            // В этом случае мы выбираем новый ключевой кадр
            // Предполагаем, что action.payload - это обновленный проект с новым ключевым кадром
            return {
                ...state,
                selectedKeyframe: action.payload.timeline.keyframes[action.payload.timeline.keyframes.length - 1].id
            };

        case types.UPDATE_KEYFRAME:
            // Обновление ключевого кадра не меняет состояние timeline
            return state;

        case types.DELETE_KEYFRAME:
            // Сбрасываем выбранный ключевой кадр, если он был удален
            return {
                ...state,
                selectedKeyframe: state.selectedKeyframe === action.payload ? null : state.selectedKeyframe
            };

        case types.STOP_AT_END:
            return {
                ...state,
                isPlaying: false,
                currentTime: state.duration
            };

        case types.RESET_TIMELINE:
            return initialState;

        default:
            return state;
    }
};

export default timelineReducer; 