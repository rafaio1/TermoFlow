import { call, put } from 'redux-saga/effects';
import * as API from '../api';
import { FETCH_LIST_FAILURE, FETCH_LIST_SUCCESS } from '../actions';
import { fetchList } from './list';

describe('redux list saga', () => {
  it('resolve e dispatch success', () => {
    const resolve = jest.fn();
    const reject = jest.fn();

    const action = {
      type: 'fetch_list_request',
      payload: { resolve, reject }
    } as any;

    const gen = fetchList(action);
    expect(gen.next().value).toEqual(call(API.fetchList));

    const list: IItem[] = [{ id: '1', name: 'item1' }];
    expect(gen.next(list).value).toEqual(put({ type: FETCH_LIST_SUCCESS, payload: list }));

    expect(resolve).toHaveBeenCalledWith(list);
    expect(reject).not.toHaveBeenCalled();
    expect(gen.next().done).toBe(true);
  });

  it('reject e dispatch failure', () => {
    const resolve = jest.fn();
    const reject = jest.fn();

    const action = {
      type: 'fetch_list_request',
      payload: { resolve, reject }
    } as any;

    const gen = fetchList(action);
    expect(gen.next().value).toEqual(call(API.fetchList));

    const error = 'boom';
    expect(gen.throw(error).value).toEqual(put({ type: FETCH_LIST_FAILURE, payload: error }));

    expect(reject).toHaveBeenCalledWith(error);
    expect(resolve).not.toHaveBeenCalled();
    expect(gen.next().done).toBe(true);
  });
});
