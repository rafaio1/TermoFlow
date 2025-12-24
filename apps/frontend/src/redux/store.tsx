import { createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import createSagaMiddleware from 'redux-saga';

import rootReducer from './reducers';
import sagas from './sagas';

const sagaMiddleware = createSagaMiddleware();
const middleware = [thunk, sagaMiddleware];

const store = createStore(rootReducer, compose(applyMiddleware(...middleware)));

sagaMiddleware.run(sagas);

export default store;
