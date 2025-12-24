import { combineReducers } from 'redux';
import list from './list';

const rootReducer = combineReducers<IReducerStates>({
  list
});

export default rootReducer;
