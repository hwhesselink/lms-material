/**
 * LMS-Material
 *
 * Copyright (c) 2018-2019 Craig Drummond <craig.p.drummond@gmail.com>
 * MIT license.
 */

const MORE_COMMANDS = new Set(["item_add", "item_insert", "itemplay", "item_fav"]);

function parseBrowseResp(data, parent, options, idStart, cacheKey) {
    // NOTE: If add key to resp, then update addToCache in utils.js
    var resp = {items: [], baseActions:[], useGrid: false, total: 0, useScroller: false, jumplist:[] };
    if (undefined==idStart) {
        idStart = 0;
    }

    try {
    if (data && data.result) {
        resp.total = (parent && parent.range ? parent.range.count : data.result.count);
        resp.useScroller = resp.total >= LMS_MIN_LIST_SCROLLER_ITEMS;
        var canUseGrid = !resp.useScroller || resp.total<=LMS_MAX_GRID_ITEMS;
        logJsonMessage("RESP", data);
        if (parent.id && TOP_SEARCH_ID===parent.id) {
            var totalResults = 0;
            if (data.result.contributors_loop && data.result.contributors_count>0) {
                totalResults += data.result.contributors_count;
                resp.items.push({header: i18np("1 Artist", "%1 Artists", data.result.contributors_count), id:"search.artists"});
                data.result.contributors_loop.forEach(i => {
                    var infoPlugin = getLocalStorageBool('infoPlugin');
                    resp.items.push({
                                  id: "artist_id:"+i.contributor_id,
                                  title: i.contributor,
                                  command: ["albums"],
                                  params: ["artist_id:"+ i.contributor_id, ALBUM_TAGS, SORT_KEY+ARTIST_ALBUM_SORT_PLACEHOLDER],
                                  image: (infoPlugin && options.artistImages) ? "/imageproxy/mai/artist/" + i.contributor_id + "/image" + LMS_LIST_IMAGE_SIZE : undefined,
                                  //icon: options.artistImages ? undefined : "person",
                                  menu: [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, ADD_RANDOM_ALBUM_ACTION, DIVIDER, ADD_TO_FAV_ACTION, SELECT_ACTION, MORE_LIB_ACTION],
                                  type: "group"
                              });
                });
            }
            if (data.result.albums_loop && data.result.albums_count>0) {
                totalResults += data.result.albums_count;
                resp.items.push({header: i18np("1 Album", "%1 Albums", data.result.albums_count), id:"search.albums"});
                data.result.albums_loop.forEach(i => {
                    resp.items.push({
                                  id: "album_id:"+i.album_id,
                                  title: i.album,
                                  command: ["tracks"],
                                  params: ["album_id:"+ i.album_id, TRACK_TAGS, SORT_KEY+"tracknum"],
                                  image: "/music/" + i.artwork + "/cover" + LMS_LIST_IMAGE_SIZE,
                                  menu: [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, DIVIDER, ADD_TO_FAV_ACTION, SELECT_ACTION, MORE_LIB_ACTION],
                                  type: "group"
                              });
                });
            }
            if (data.result.tracks_loop && data.result.tracks_count>0) {
                totalResults += data.result.tracks_count;
                resp.items.push({header: i18np("1 Track", "%1 Tracks", data.result.tracks_count), id:"search.tracks"});
                data.result.tracks_loop.forEach(i => {
                    resp.items.push({
                                  id: "track_id:"+i.track_id,
                                  title: i.track,
                                  image: "/music/" + i.coverid + "/cover" +LMS_LIST_IMAGE_SIZE,
                                  menu: [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, DIVIDER, SELECT_ACTION, MORE_LIB_ACTION],
                                  type: "track"
                              });
                });
            }
            if (data.result.genres_loop && data.result.genres_count>0) {
                totalResults += data.result.genres_count;
                resp.items.push({header: i18np("1 Genre", "%1 Genres", data.result.genres_count), id:"search.genres"});
                data.result.genres_loop.forEach(i => {
                    resp.items.push({
                                  id: "genre_id:"+i.genre_id,
                                  title: i.genre,
                                  command: ["artists"],
                                  params: ["genre_id:"+ i.genre_id],
                                  //icon: "label",
                                  menu: [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, ADD_RANDOM_ALBUM_ACTION, DIVIDER, ADD_TO_FAV_ACTION, SELECT_ACTION, MORE_LIB_ACTION],
                                  type: "group"
                              });
                });
            }
            resp.subtitle=i18np("1 Item", "%1 Items", totalResults);
            resp.total = resp.items.length;
        } else if (data.result.indexList) { // Split artist/albums into A..Z groups
            var start=0;
            var isArtists = data.result.artists_loop;

            // Ensure we have at lest "tags:s" for textkey
            var parentParams = [];
            var hasTags = false;
            parent.params.forEach(p=>{
                if (p.startsWith("tags:")) {
                    if (p.split(":")[1].indexOf('s')<0) {
                        p+='s';
                    }
                    parentParams.push(p);
                    hasTags = true;
                }
            });
            if (!hasTags) {
                parentParams.push("tags:s");
            }

            // Look for first valid key? Looks like 'No Album' messes up album txtkeys? First 2 seem to be garbage...
            if (data.result.artists_loop) {
                for (var i=0; i<data.result.artists_loop.length; ++i) {
                    if (data.result.artists_loop[i].textkey!=null && data.result.artists_loop[i].textkey!=undefined && data.result.artists_loop[i].textkey.length>0) {
                        start = i;
                        break;
                    }
                }
            } else if (data.result.albums_loop) {
                for (var i=0; i<data.result.albums_loop.length; ++i) {
                    if (data.result.albums_loop[i].textkey!=null && data.result.albums_loop[i].textkey!=undefined && data.result.albums_loop[i].textkey.length>0) {
                        start = i;
                        break;
                    }
                }
            }

            var prevItem = undefined;

            for (var i=start; i<data.result.indexList.length; ++i) {
                var name = data.result.indexList[i][0];
                if (name == null) {
                    name = "?";
                }
                var count = data.result.indexList[i][1];

                // If we have more than max items in this 1 group, then split
                if (count>=LMS_AZ_MAX_PER_LETTER) {
                    if (prevItem) {
                        if (undefined!==prevItem.subtitle && prevItem.subtitle!=prevItem.title) {
                            prevItem.title += " .. " + prevItem.subtitle;
                        }
                        prevItem.subtitle = isArtists
                                                ? i18np("1 Artist", "%1 Artists", prevItem.range.count)
                                                : i18np("1 Album", "%1 Albums", prevItem.range.count);
                        prevItem.id="az:"+resp.items.length;
                        resp.items.push(prevItem);
                        prevItem = undefined;
                    }

                    for (var c=0; c<count; c+=LMS_AZ_MAX_PER_LETTER) {
                        var total=c+LMS_AZ_MAX_PER_LETTER>count ? (count-c) : LMS_AZ_MAX_PER_LETTER;
                        resp.items.push({
                                            title: name+" ("+(c+1)+".."+(c+total)+")",
                                            subtitle: isArtists
                                                ? i18np("1 Artist", "%1 Artists", total)
                                                : i18np("1 Album", "%1 Albums", total),
                                            range: {start: start+c, count: total},
                                            type: "group",
                                            command: parent.command,
                                            params: parentParams,
                                            id: "az:"+resp.items.length
                                        });
                    }
                    start += count;
                    continue;
                }

                var item = {
                                title: name,
                                range: {start: start, count: count},
                                type: "group",
                                command: parent.command,
                                params: parentParams
                            };

                if (prevItem) {
                    if (prevItem.range.count>1 && (prevItem.range.count + count > LMS_AZ_MAX_SIZE)) {
                        if (undefined!==prevItem.subtitle && prevItem.subtitle!=prevItem.title) {
                            prevItem.title += " .. " + prevItem.subtitle;
                        }
                        prevItem.subtitle = isArtists
                                                ? i18np("1 Artist", "%1 Artists", prevItem.range.count)
                                                : i18np("1 Album", "%1 Albums", prevItem.range.count);
                        if (prevItem.range.count>=LMS_BATCH_SIZE) {
                            prevItem.cancache = true;
                        }
                        prevItem.id="az:"+resp.items.length;
                        resp.items.push(prevItem);
                        prevItem = item;
                    } else {
                        prevItem.subtitle = name;
                        prevItem.range.count += count;
                    }
                } else if (item.range.count >= LMS_AZ_MAX_SIZE) {
                    item.subtitle = isArtists
                                        ? i18np("1 Artist", "%1 Artists", count)
                                        : i18np("1 Album", "%1 Albums", count);
                    if (count>=LMS_BATCH_SIZE) {
                        item.cancache = true;
                    }
                    item.id="az:"+resp.items.length;
                    resp.items.push(item);
                } else {
                    prevItem = item;
                    prevItem.subtitle = name;
                }
                start += count;
            }
            if (prevItem) {
                if (undefined!==prevItem.subtitle && prevItem.subtitle!=prevItem.title) {
                    prevItem.title += " .. " + prevItem.subtitle;
                }
                prevItem.subtitle = isArtists
                                        ? i18np("1 Artist", "%1 Artists", prevItem.range.count)
                                        : i18np("1 Album", "%1 Albums", prevItem.range.count);
                if (prevItem.range.count>=LMS_BATCH_SIZE) {
                    prevItem.cancache = true;
                }
                prevItem.id="az:"+resp.items.length;
                resp.items.push(prevItem);
            }
            resp.total=resp.items.length;
            resp.subtitle=i18np("1 Category", "%1 Categories", resp.total);
            resp.useScroller = false;
        } else if (data.result.item_loop) {  // SlimBrowse response
            var playAction = false;
            var addAction = false;
            var insertAction = false;
            var moreAction = false;
            var isFavorites = parent && parent.isFavFolder;
            var isPlaylists = parent && parent.id == TOP_PLAYLISTS_ID;
            var isRadios = parent && parent.section == SECTION_RADIO;
            var isApps = parent && parent.id == TOP_APPS_ID;
            var isTrackStat = data && data.params && data.params.length>1 && data.params[1] && data.params[1].length>1 &&
                              data.params[1][0]=="trackstat";
            var haveWithIcons = false;
            var haveWithoutIcons = false;
            // Create a unique ID for favorites each time it is listed. When list is re-ordered via d'n'd we
            // need different IDs for the re-ordered items so that the correct cover is shown.
            var uniqueness = isFavorites ? new Date().getTime().toString(16) : undefined;
            var menu = undefined;

            resp.useGrid = canUseGrid && !isTrackStat && options.useGrid=='always' && data.result.window && data.result.window.windowStyle && data.result.window.windowStyle=="icon_list";

            if (data.result.base && data.result.base.actions) {
                resp.baseActions = data.result.base.actions;
                playAction = undefined != resp.baseActions[B_ACTIONS[PLAY_ACTION].cmd];
                addAction = undefined != resp.baseActions[B_ACTIONS[ADD_ACTION].cmd];
                insertAction = undefined != resp.baseActions[B_ACTIONS[INSERT_ACTION].cmd];
                moreAction = undefined!=resp.baseActions[B_ACTIONS[MORE_ACTION].cmd];
                if (resp.useGrid && parent && parent.actions && parent.actions.go && parent.actions.go.cmd &&
                    parent.actions.go.cmd[0] == "playhistory") {
                    resp.useGrid = false;
                }
                if (resp.baseActions[B_ACTIONS[PLAY_ACTION].cmd] && resp.baseActions[B_ACTIONS[PLAY_ACTION].cmd].params && resp.baseActions[B_ACTIONS[PLAY_ACTION].cmd].params.menu) {
                    menu = resp.baseActions[B_ACTIONS[PLAY_ACTION].cmd].params.menu;
                }
            }

            data.result.item_loop.forEach(i => {
                if (!i.text || i.showBigArtwork==1) {
                    resp.total--;
                    return;
                }
                if (resp.items.length==resp.total-1 && i.type=="playlist" && i['icon-id']=='html/images/albums.png') {
                    // Remove 'All Songs' entry
                    resp.total--;
                    return;
                }
                var addedPlayAction = false;

                if ("text"==i.type) {
                    // Exclude 'More' Play,Insert,Fav commands
                    if (i.style && MORE_COMMANDS.has(i.style)) {
                        resp.total--;
                        return;
                    }
                    i.title = replaceNewLines(i.text);
                } else {
                    var text = i.text.split(/\r?\n/);
                    i.title = text[0];
                    if (text.length>1) {
                        i.subtitle = text[1];
                    } else {
                        i.title=i.text;
                    }
                }

                if (!i.type && !i.style && i.actions && i.actions.go && i.actions.go.params) {
                    for (var key in i.actions.go.params) {
                        if (i.actions.go.params[key]==TERM_PLACEHOLDER) {
                            i.type = "entry";
                            resp.useGrid = false;
                        }
                    }
                }

                // Issue #58 Pretend 'text' with a go action is just a text line, so that click() works
                if (undefined==i.type && !i.style && i.actions && i.actions.go && !i.icon && !i["icon-id"] && !i.image && !i.window &&
                    (!i.addAction || i.actions.go.nextWindow)) {
                    i.type="text";
                }

                i.text = undefined;
                i.image = resolveImage(i.icon ? i.icon : i["icon-id"], undefined, resp.useGrid ? LMS_GRID_IMAGE_SIZE : LMS_LIST_IMAGE_SIZE);

                if (!i.image && i.commonParams && i.commonParams.album_id) {
                    i.image = resolveImage("music/0/cover" + (resp.useGrid ? LMS_GRID_IMAGE_SIZE : LMS_LIST_IMAGE_SIZE));
                }

                if (i.image) {
                    haveWithIcons = true;
                } else {
                    haveWithoutIcons = true;
                }
                i.menu=[];

                if (i.type=="artist" || i.type=="album" || i.type=="year" || i.type=="genre" || // CustomBrowse
                    i.type=="playlist" || i.type=="audio" || i.style=="itemplay" || (i.goAction && (i.goAction == "playControl" || i.goAction == "play"))) {
                    // Convert NUM. TITLE into 0NUM TITLE - e.g 1. Wibble => 01 Wibble
                    if (/^[0-9]+\.\s.+/.test(i.title)) {
                        var dot = i.title.indexOf('.');
                        var num = parseInt(i.title.substring(0, dot));
                        var text = i.title.substring(dot+2, i.title.length);
                        i.title = (num>9 ? num : ("0" + num))+" "+text;
                    }
                    if ((i.params && hasPlayableId(i.params)) || (i.commonParams && hasPlayableId(i.commonParams)) ||
                        (i.actions && i.actions.add && i.actions.add.params && hasPlayableId(i.actions.add.params)) ) {
                        if (playAction) {
                            i.menu.push(PLAY_ACTION);
                            addedPlayAction = true;
                        }
                        if (insertAction) {
                            i.menu.push(INSERT_ACTION);
                            addedPlayAction = true;
                        }
                        if (addAction) {
                            i.menu.push(ADD_ACTION);
                            addedPlayAction = true;
                        }
                    }
                }
                var addedDivider = false;
                if (isFavorites) {
                    if (i.menu.length>0) {
                        i.menu.push(DIVIDER);
                        addedDivider = true;
                    }
                    i.menu.push(REMOVE_FROM_FAV_ACTION);
                    if (!i.type) {
                        i.isFavFolder = true;
                    }
                    i.menu.push(i.isFavFolder ? RENAME_FAV_ACTION : EDIT_FAV_ACTION);
                } else if (i.presetParams) {
                    if (i.menu.length>0) {
                        i.menu.push(DIVIDER);
                        addedDivider = true;
                    }
                    i.menu.push(ADD_TO_FAV_ACTION);
                }

                if (addedPlayAction) {
                    if (!addedDivider) {
                        i.menu.push(DIVIDER);
                        addedDivider = true;
                    }
                    i.menu.push(SELECT_ACTION);
                }

                if (isPlaylists) {
                    if (!addedDivider && i.menu.length>0) {
                        i.menu.push(DIVIDER);
                        addedDivider = true;
                    }
                    i.menu.push(RENAME_PL_ACTION);
                    i.menu.push(DELETE_ACTION);
                }

                if (!i.type && i.actions && i.actions.go && i.actions.go.cmd) {
                    i.actions.go.cmd.forEach(a => {
                        if ("search" == a) {
                            i.type = "search";
                            resp.useGrid = false;
                            return;
                        }
                    });
                }

                if (!i.type && i.style && i.style=="itemNoAction") {
                    i.type = "text";
                    resp.useGrid = false;
                }

                if (isApps && i.actions && i.actions.go && i.actions.go.params && i.actions.go.params.menu) {
                    if ("myapps" == i.actions.go.params.menu) { // mysqueezebox.com apps
                        if (i.actions.go.params.item_id) {
                            i.id = fixId(i.actions.go.params.item_id, "myapps");
                        }
                    } else {
                        i.id = "apps."+i.actions.go.params.menu;
                    }

                    if (i.id) {
                        if (!addedDivider && i.menu.length>0) {
                            i.menu.push(DIVIDER);
                            addedDivider = true;
                        }
                        i.menu.push(options.pinned.has(i.id) ? UNPIN_ACTION : PIN_ACTION);
                    }
                } else if (isPlaylists && i.commonParams && i.commonParams.playlist_id) {
                    i.id = "playlist_id:"+i.commonParams.playlist_id;
                } else if (isRadios && i.type!="search") {
                    if (!i.id) {
                        if (i.params && i.params.item_id) {
                            i.id = fixId(i.params.item_id, undefined==menu ? "radio" : menu);
                        } else if (i.presetParams && i.presetParams.favorites_url) {
                            i.id = "radio:"+i.presetParams.favorites_url;
                        } else if (i.actions && i.actions.go && i.actions.go.params && i.actions.go.params.item_id) {
                            i.id = "item_id:"+i.actions.go.params.item_id;
                        } else if (parent && parent.id && TOP_RADIO_ID!=parent.id) {
                            i.id = parent.id+"."+i.title;
                        } else {
                            i.id = "radio:"+i.title;
                        }
                    }
                    if (i.menu.length>0 && (i.icon || i.image) && i.type!="entry") {
                        // Only allow to pin if we can play!
                        if (!addedDivider && i.menu.length>0) {
                            i.menu.push(DIVIDER);
                            addedDivider = true;
                        }
                        i.menu.push(options.pinned.has(i.id) ? UNPIN_ACTION : PIN_ACTION);
                    }
                } else if (!isFavorites) { // move/rename on favs needs ids of a.b.c (created below)
                    if (i.params && i.params.item_id) {
                        i.id = "item_id:"+i.params.item_id;
                    } else if (i.actions && i.actions.go && i.actions.go.params && i.actions.go.params.item_id) {
                        i.id = "item_id:"+i.actions.go.params.item_id;
                    }
                }

                if (!i.id) {
                    if (parent.id.startsWith(TOP_ID_PREFIX)) {
                        i.id="item_id:"+(resp.items.length+idStart);
                    } else {
                        i.id=parent.id+"."+(resp.items.length+idStart);
                    }
                }

                // TrackStat...
                if (!i.type && i.params && i.params.track) {
                    i.type = "audio";
                }

                // Only show 'More' action if ('more' is in baseActions and item as item_id) OR
                // 'more' is in item's actions. #57
                if ( ((moreAction && i.menu.length>0 && i.params && i.params.item_id) ||
                     (i.actions && i.actions.more && i.actions.more.cmd)) &&
                     !(i.actions && i.actions.go && i.actions.go.params && i.actions.go.params.year)) {
                    if (!addedDivider && i.menu.length>0) {
                        i.menu.push(DIVIDER);
                        addedDivider = true;
                    }
                    i.menu.push(MORE_ACTION);
                }

                if (resp.useGrid && i.image) {
                    var rep=["_100x100.png", "100x100.png", "_100x100_o", "100x100_o",
                             "_50x50.png", "50x50.png", "_50x50_o", "50x50_o"];
                    for (var r=0; r<rep.length; ++r) {
                        if (i.image.endsWith(rep[r])) {
                            i.image=i.image.replace(rep[r], LMS_GRID_IMAGE_SIZE);
                            break;
                        }
                    }
                }
                i.section = parent ? parent.section : undefined;
                
                var key = i.textkey;
                if (undefined!=key && (resp.jumplist.length==0 || resp.jumplist[resp.jumplist.length-1].key!=key)) {
                    resp.jumplist.push({key: key, index: resp.items.length+idStart});
                }
                resp.items.push(i);
            });
            if (0==resp.items.length && data.result.window && data.result.window.textarea) {
                resp.items.push({
                                title: replaceNewLines(data.result.window.textarea),
                                type: "text",
                                id: parent.id+"."+idStart
                               });
                resp.useGrid = false;
            } else if (haveWithoutIcons && haveWithIcons && resp.items.length == resp.total) {
                var defCover = parent.image ? parent.image
                                            : resolveImage("music/0/cover" + (resp.useGrid ? LMS_GRID_IMAGE_SIZE : LMS_LIST_IMAGE_SIZE));
                resp.items.forEach(i => {
                    if (!i.image) {
                        i.image = defCover;
                    }
                });
            }

            if (resp.total == resp.items.length) {
                if (isApps) {
                    resp.items.sort(titleSort);
                } else if (isFavorites) {
                    resp.items.sort(favSort);
                }
            }
        } else if (data.result.artists_loop) {
            var params = [];
            if (parent && parent.params) {
                parent.params.forEach(p => {
                    if (p.startsWith("role_id:") || (!options.noGenreFilter && p.startsWith("genre_id:"))) {
                        params.push(p);
                    }
                });
            }
            var infoPlugin = getLocalStorageBool('infoPlugin');
            resp.useGrid = canUseGrid && options.useGrid=='always' && infoPlugin && options.artistImages;
            data.result.artists_loop.forEach(i => {
                var key = i.textkey;
                if (undefined!=key && (resp.jumplist.length==0 || resp.jumplist[resp.jumplist.length-1].key!=key)) {
                    resp.jumplist.push({key: key, index: resp.items.length+idStart});
                }
                var artist = {
                              id: "artist_id:"+i.id,
                              title: i.artist,
                              command: ["albums"],
                              image: (infoPlugin && options.artistImages) ? "/imageproxy/mai/artist/" + i.id + "/image" +
                                    (resp.useGrid ? LMS_GRID_IMAGE_SIZE : LMS_LIST_IMAGE_SIZE) : undefined,
                              params: ["artist_id:"+ i.id, "tags:jlys", SORT_KEY+ARTIST_ALBUM_SORT_PLACEHOLDER],
                              menu: [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, ADD_RANDOM_ALBUM_ACTION, DIVIDER, ADD_TO_FAV_ACTION, SELECT_ACTION, MORE_LIB_ACTION],
                              type: "group",
                              textkey: key
                          };
                if (params.length>0) {
                    params.forEach(p => {
                        artist.params.push(p);
                    });
                }
                resp.items.push(artist);
            });
            resp.subtitle=i18np("1 Artist", "%1 Artists", parent && parent.range ? parent.range.count : resp.total);
        } else if (data.result.albums_loop) {
            resp.actions=[ADD_ACTION, DIVIDER, PLAY_ACTION];
            resp.useGrid = canUseGrid && options.useGrid!='never';
            var params = [];
            if (parent && parent.params && (!options.noRoleFilter || !options.noGenreFilter)) {
                parent.params.forEach(p => {
                    if ( (!options.noRoleFilter && (p.startsWith("role_id:") || p.startsWith("artist_id:"))) ||
                         (!options.noGenreFilter && p.startsWith("genre_id:"))) {
                        params.push(p);
                    }
                });
            }

            data.result.albums_loop.forEach(i => {
                var title = i.album;
                if (i.year && i.year>0) {
                    title+=" (" + i.year + ")";
                }
                var key = i.textkey;
                if (undefined!=key && (resp.jumplist.length==0 || resp.jumplist[resp.jumplist.length-1].key!=key)) {
                    resp.jumplist.push({key: key, index: resp.items.length+idStart});
                }
                var album = {
                              id: "album_id:"+i.id,
                              title: title,
                              subtitle: i.artist ? i.artist : undefined,
                              command: ["tracks"],
                              image: "/music/" + i.artwork_track_id + "/cover" + (resp.useGrid ? LMS_GRID_IMAGE_SIZE : LMS_LIST_IMAGE_SIZE),
                              params: ["album_id:"+ i.id, TRACK_TAGS, SORT_KEY+"tracknum"],
                              menu: [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, DIVIDER, ADD_TO_FAV_ACTION, SELECT_ACTION, MORE_LIB_ACTION],
                              type: "group",
                              origTitle: i.album,
                              // Bug on my system? There is a 'No Album' entry with no tracks!
                              disabled: undefined!==i.year && 0==i.year && i.artist && "No Album"===i.album && "Various Artists"===i.artist,
                              textkey: key
                          };
                if (params.length>0) {
                    params.forEach(p => {
                        album.params.push(p);
                    });
                }
                resp.items.push(album);
            });
            resp.subtitle=i18np("1 Album", "%1 Albums", parent && parent.range ? parent.range.count : resp.total);
        } else if (data.result.titles_loop) {
            resp.actions=[ADD_ACTION, DIVIDER, PLAY_ACTION];
            var duration=0;
            var allowPlayAlbum = (parent && parent.id && parent.id.startsWith("album_id:"));

            if (!allowPlayAlbum && data.params[1].length>=4 && data.params[1][0]=="tracks") {
                data.params[1].forEach(p => {
                    if ((""+p).startsWith("album_id:")) {
                        allowPlayAlbum = true;
                        return;
                    }
                });
            }

            var actions = [PLAY_ACTION];
            if (allowPlayAlbum && resp.total>1) {
                actions.push(PLAY_ALBUM_ACTION);
            }

            actions.push(INSERT_ACTION);
            actions.push(ADD_ACTION);
            actions.push(DIVIDER);
            actions.push(SELECT_ACTION);
            if (options.ratingsSupport) {
                actions.push(RATING_ACTION);
            }
            actions.push(MORE_LIB_ACTION);
            data.result.titles_loop.forEach(i => {
                var title = i.title;
                if (i.tracknum>0) {
                     title = (i.tracknum>9 ? i.tracknum : ("0" + i.tracknum))+" "+title;
                     //title = i.tracknum + ". " + title; // SlimBrowse format
                }
                if (i.trackartist && ( (i.albumartist && i.trackartist !== i.albumartist) || (!i.albumartist && i.compilation=="1"))) {
                     title+=SEPARATOR + i.trackartist;
                } else if (i.artist && ( (i.albumartist && i.artist !== i.albumartist) || (!i.albumartist && i.compilation=="1"))) {
                     title+=SEPARATOR + i.artist;
                }
                duration+=parseFloat(i.duration || 0);
                resp.items.push({
                              id: "track_id:"+i.id,
                              title: title,
                              subtitle: formatSeconds(i.duration),
                              //icon: "music_note",
                              menu: actions,
                              type: "track"
                          });
            });
            resp.subtitle=i18np("1 Track", "%1 Tracks", resp.total);
            if (data.result.titles_loop.length===resp.total) {
                resp.subtitle+=" ("+formatSeconds(duration)+")";
            }
        } else if (data.result.genres_loop) {
            data.result.genres_loop.forEach(i => {
                var key = i.textkey;
                if (undefined!=key && (resp.jumplist.length==0 || resp.jumplist[resp.jumplist.length-1].key!=key)) {
                    resp.jumplist.push({key: key, index: resp.items.length+idStart});
                }
                resp.items.push({
                              id: "genre_id:"+i.id,
                              title: i.genre,
                              command: ["artists"],
                              //icon: "label",
                              params: ["genre_id:"+ i.id],
                              menu: [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, ADD_RANDOM_ALBUM_ACTION, DIVIDER, ADD_TO_FAV_ACTION, SELECT_ACTION, MORE_LIB_ACTION],
                              type: "group",
                              textkey: key
                          });
            });
            resp.subtitle=i18np("1 Genre", "%1 Genres", resp.total);
        } else if (data.result.playlists_loop) {
            data.result.playlists_loop.forEach(i => {
                resp.items.push({
                              id: "playlist_id:"+i.id,
                              title: i.playlist,
                              command: ["playlists", "tracks"],
                              //icon: "list",
                              params: ["playlist_id:"+ i.id],
                              menu: [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, DIVIDER, ADD_TO_FAV_ACTION, SELECT_ACTION, RENAME_PL_ACTION, DELETE_ACTION],
                              type: "group"
                          });
            });
            resp.subtitle=i18np("1 Playlist", "%1 Playlists", resp.total);
        } else if (data.result.playlisttracks_loop) {
            resp.actions=[ADD_ACTION, DIVIDER, PLAY_ACTION];
            var actions = [PLAY_ACTION, INSERT_ACTION, ADD_ACTION];
            /*if (options.ratingsSupport) {
                actions.push(DIVIDER);
                actions.push(RATING_ACTION);
            }*/
            data.result.playlisttracks_loop.forEach(i => {
                var title = i.title;
                if (i.artist) {
                    title+=SEPARATOR + i.artist;
                }
                if (!title) {
                    title=i18n("Unknown");
                }
                var duration = parseFloat(i.duration || 0)
                var subtitle = duration>0 ? formatSeconds(duration) : undefined;
                if (i.album) {
                    if (subtitle) {
                        subtitle+=SEPARATOR+i.album;
                    } else {
                        subtitle=i.album;
                    }
                }
                resp.items.push({
                              id: "track_id:"+i.id,
                              title: title,
                              subtitle: subtitle,
                              //icon: "music_note",
                              menu: actions,
                              type: "track"
                          });
            });
            resp.subtitle=i18np("1 Track", "%1 Tracks", resp.total);
        } else if (data.result.years_loop) {
            data.result.years_loop.forEach(i => {
                var key = i.textkey;
                if (undefined!=key && (resp.jumplist.length==0 || resp.jumplist[resp.jumplist.length-1].key!=key)) {
                    resp.jumplist.push({key: key, index: resp.items.length+idStart});
                }
                resp.items.push({
                              id: "year:"+i.year,
                              title: i.year,
                              command: ["albums"],
                              //icon: "date_range",
                              params: ["year:"+ i.year, "tags:ajlys"],
                              menu: [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, ADD_RANDOM_ALBUM_ACTION, DIVIDER, ADD_TO_FAV_ACTION, SELECT_ACTION],
                              type: "group",
                              textkey: key
                          });
            });
            resp.subtitle=i18np("1 Year", "%1 Years", resp.total);
        } else if (data.result.folder_loop) {
            data.result.folder_loop.forEach(i => {
                var isFolder = i.type==="folder";
                var key = i.textkey;
                if (undefined!=key && (resp.jumplist.length==0 || resp.jumplist[resp.jumplist.length-1].key!=key)) {
                    resp.jumplist.push({key: key, index: resp.items.length+idStart});
                }
                resp.items.push({
                              id: (isFolder ? "folder_id:" : "track_id:") + i.id,
                              title: i.filename,
                              subtitle: i.duration!="" && !isFolder ? i.duration : undefined,
                              command: ["musicfolder"],
                              params: ["folder_id:"+i.id, "type:audio", "tags:ds"],
                              menu: [PLAY_ACTION, INSERT_ACTION, ADD_ACTION],
                              type: isFolder ? "group" : "track",
                              icon: isFolder ? "folder" : undefined,
                              textkey: key
                          });
            });
            resp.subtitle=i18np("1 Item", "%1 Items", resp.total);
        } /*else if (data.result.radioss_loop) {
            data.result.radioss_loop.forEach(i => {
                if ("xmlbrowser"===i.type) {
                    resp.items.push({
                                  title: i.name ? i.name : i.title,
                                  command: [i.cmd, "items"],
                                  image: resolveImage(i.icon, i.image, LMS_LIST_IMAGE_SIZE),
                                  params: ["want_url:1"],
                                  type: "group",
                                  id: parent.id+i.cmd,
                                  app: i.cmd
                          });
                } else if ("xmlbrowser_search"===i.type) {
                    resp.items.push({
                                  title: i.name ? i.name : i.title,
                                  command: [i.cmd, "items"],
                                  image: resolveImage(i.icon, i.image, LMS_LIST_IMAGE_SIZE),
                                  //icon: "search",
                                  params: ["want_url:1", "search:"+TERM_PLACEHOLDER],
                                  type: "search",
                                  id: parent.id+i.cmd,
                                  app: i.cmd
                          });
                }
            });
        } else if (data.result.appss_loop) {
            data.result.appss_loop.forEach(i => {
                if ("xmlbrowser"===i.type) {
                    resp.items.push({
                                  title: i.name ? i.name : i.title,
                                  command: [i.cmd, "items"],
                                  image: resolveImage(i.icon, i.image, LMS_LIST_IMAGE_SIZE),
                                  params: ["want_url:1"],
                                  type: "group",
                                  id: parent.url+i.cmd,
                                  app: i.cmd
                          });
                } else if ("xmlbrowser_search"===i.type) {
                    resp.items.push({
                                  title: i.name ? i.name : i.title,
                                  command: [i.cmd, "items"],
                                  image: resolveImage(i.icon, i.image, LMS_LIST_IMAGE_SIZE),
                                  //icon: "search",
                                  params: ["want_url:1", "search:"+TERM_PLACEHOLDER],
                                  type: "search",
                                  id: parent.id+i.cmd,
                                  app: i.cmd
                          });
                }
            });
            resp.subtitle=i18np("1 App", "%1 Apps", resp.total);
            if (data.result.appss_loop.length === resp.total) {
                // Have all apps, so sort...
                resp.items.sort(titleSort);
            }
        } else if (data.result.loop_loop) {
            var topLevelFavourites = "favorites"===parent.type && parent.id.startsWith("top:/");
            data.result.loop_loop.forEach(i => {
                if ("text"===i.type || "textarea"===i.type) {
                    resp.items.push({
                                  title: replaceNewLines(i.name ? i.name : i.title),
                                  type: "text",
                                  id: i.id
                               });
                } else if ("search"===i.type) {
                    resp.items.push({
                                  title: i.name ? i.name : i.title,
                                  command: [i.cmd ? i.cmd : parent.command[0], "items"],
                                  image: resolveImage(i.icon, i.image, LMS_LIST_IMAGE_SIZE),
                                  //icon: "search",
                                  params: ["want_url:1", "item_id:"+i.id, "search:"+TERM_PLACEHOLDER],
                                  type: "search",
                                  id: parent.url+i.cmd+i.id,
                                  app: parent.app
                               });
                } else if (i.hasitems>0) {
                    resp.items.push({
                                  title: i.name ? i.name : i.title,
                                  command: parent.command,
                                  image: resolveImage(i.icon, i.image, LMS_LIST_IMAGE_SIZE),
                                  //icon: "folder"==i.type || "url"==i.type ? "folder" : "chevron_right",
                                  params: ["item_id:"+i.id, "want_url:1"],
                                  type: "group",
                                  url: i.url,
                                  app: parent.app,
                                  menu: "favorites"===parent.type
                                                ? topLevelFavourites
                                                    ? [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, DIVIDER, EDIT_FAV_ACTION, REMOVE_FROM_FAV_ACTION, SELECT_ACTION]
                                                    : [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, DIVIDER, SELECT_ACTION]
                                                : i.isaudio === 1
                                                    ? i.url
                                                        ? [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, DIVIDER, ADD_TO_FAV_ACTION, SELECT_ACTION]
                                                        : [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, DIVIDER, SELECT_ACTION]
                                                    : i.url
                                                        ? [ADD_TO_FAV_ACTION, DIVIDER, SELECT_ACTION]
                                                        : undefined,
                                  id: "item_id:"+i.id,
                                  favIcon: i.image ? i.image : i.icon
                               });
                } else if (i.isaudio === 1) {
                    resp.items.push({
                                  title: i.name ? i.name : i.title,
                                  url: i.url,
                                  image: resolveImage(i.icon, i.image, LMS_LIST_IMAGE_SIZE),
                                  //icon: i.url && (i.url.startsWith("http:") || i.url.startsWith("https:")) ? "wifi_tethering" : "music_note",
                                  type: "track",
                                  menu: "favorites"===parent.type
                                                ? topLevelFavourites
                                                    ? [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, DIVIDER, EDIT_FAV_ACTION, REMOVE_FROM_FAV_ACTION, SELECT_ACTION]
                                                    : [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, DIVIDER, SELECT_ACTION]
                                                : i.url
                                                    ? [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, DIVIDER, ADD_TO_FAV_ACTION, SELECT_ACTION]
                                                    : [PLAY_ACTION, INSERT_ACTION, ADD_ACTION, DIVIDER, SELECT_ACTION],
                                  app: parent.app,
                                  id: "item_id:"+i.id,
                                  favIcon: i.image ? i.image : i.icon
                               });
                    if (i.description && 1==resp.total) {
                        resp.total+=1;
                        data.result.loop_loop.length+=1;
                        var details;
                        if (i.line1) {
                            details = "<b>"+i.line1+"</b>";
                            if (i.line2) {
                                 details += "<br/><br/>"+i.line2;
                            }
                        }
                        if (details) {
                            details += "<br/><br/>"+i.description;
                        } else {
                            details = i.description;
                        }

                        resp.items.push({
                                  title: replaceNewLines(details),
                                  type: "text",
                                  id: i.id+"-descr"
                               });
                    }
                }
            });
        } */ else if (0===resp.total && data.result.networkerror) {
            resp.items.push({title: i18n("Failed to retrieve listing. (%1)", data.result.networkerror), type: "text"});
        } else if (data.result.data && data.result.data.constructor === Array && data.result.title) { // pictures?
            data.result.data.forEach(i => {
                if (i.image) {
                    i.id = "image:"+resp.items.length,
                    i.type = "image";
                    i.thumb = resolveImage(null, i.image, LMS_GRID_IMAGE_SIZE);
                    i.src = resolveImage(null, i.image);
                    i.w=0;
                    i.h=0;
                    resp.items.push(i);
                }
            });
            if (resp.items.length>0) {
                resp.title=data.result.title;
                resp.subtitle=i18np("1 Image", "%1 Images", resp.items.length);
                resp.useGrid = true;
            }
            resp.total = resp.items.length;
        }

        if (resp.total>LMS_BATCH_SIZE) {
            resp.subtitle = i18n("Only showing %1 items", LMS_BATCH_SIZE);
            resp.total = LMS_BATCH_SIZE;
        }

        if (cacheKey && lmsLastScan && canUseCache) { // canUseCache defined in utils.js
            resp.iscache=true;
            idbKeyval.set(cacheKey, resp);
        }
    } else if (data && data.iscache) { // From cache
        resp = data;
    }

    } catch(e) {
        resp.items.push({title:i18n("ERROR: List processing failed")+"\n"+e, type: 'text', id:'error'});
        logError(e);
    }

    return resp;
}

