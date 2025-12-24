import reducer from './list';
import { FETCH_LIST_SUCCESS } from '../actions';

describe('redux list reducer', () => {
  it('retorna estado inicial', () => {
    expect(reducer(undefined, { type: 'unknown', payload: [] })).toEqual([]);
  });

  it('aplica FETCH_LIST_SUCCESS', () => {
    const list: IItem[] = [
      { id: '1', name: 'item1' },
      { id: '2', name: 'item2' }
    ];

    expect(reducer([], { type: FETCH_LIST_SUCCESS, payload: list })).toEqual(list);
  });
});
