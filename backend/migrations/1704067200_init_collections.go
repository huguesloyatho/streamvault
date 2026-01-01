package migrations

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/daos"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(db dbx.Builder) error {
		dao := daos.New(db)

		// Update users collection with TOTP fields
		usersCollection, err := dao.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		// Add TOTP fields to users
		totpFields := []*schema.SchemaField{
			{
				Name:     "totp_enabled",
				Type:     schema.FieldTypeBool,
				Required: false,
				Options:  &schema.BoolOptions{},
			},
			{
				Name:     "totp_secret",
				Type:     schema.FieldTypeText,
				Required: false,
				Options: &schema.TextOptions{
					Max: types.Pointer(256),
				},
			},
			{
				Name:     "totp_secret_pending",
				Type:     schema.FieldTypeText,
				Required: false,
				Options: &schema.TextOptions{
					Max: types.Pointer(256),
				},
			},
			{
				Name:     "totp_verified_at",
				Type:     schema.FieldTypeText,
				Required: false,
				Options: &schema.TextOptions{
					Max: types.Pointer(64),
				},
			},
		}

		for _, field := range totpFields {
			usersCollection.Schema.AddField(field)
		}

		if err := dao.SaveCollection(usersCollection); err != nil {
			return err
		}

		// Create profiles collection
		// Note: Using ~ instead of = for relation fields as they are stored as arrays
		profilesCollection := &models.Collection{
			Name:       "profiles",
			Type:       models.CollectionTypeBase,
			ListRule:   types.Pointer("user ~ @request.auth.id"),
			ViewRule:   types.Pointer("user ~ @request.auth.id"),
			CreateRule: types.Pointer("@request.auth.id != ''"),
			UpdateRule: types.Pointer("user ~ @request.auth.id"),
			DeleteRule: types.Pointer("user ~ @request.auth.id"),
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name:     "user",
					Type:     schema.FieldTypeRelation,
					Required: true,
					Options: &schema.RelationOptions{
						CollectionId:  usersCollection.Id,
						CascadeDelete: true,
					},
				},
				&schema.SchemaField{
					Name:     "name",
					Type:     schema.FieldTypeText,
					Required: true,
					Options: &schema.TextOptions{
						Min: types.Pointer(1),
						Max: types.Pointer(50),
					},
				},
				&schema.SchemaField{
					Name:     "avatar",
					Type:     schema.FieldTypeFile,
					Required: false,
					Options: &schema.FileOptions{
						MaxSelect: 1,
						MaxSize:   5242880,
						MimeTypes: []string{"image/jpeg", "image/png", "image/gif", "image/webp"},
					},
				},
				&schema.SchemaField{
					Name:     "is_kids",
					Type:     schema.FieldTypeBool,
					Required: false,
					Options:  &schema.BoolOptions{},
				},
				&schema.SchemaField{
					Name:     "pin",
					Type:     schema.FieldTypeText,
					Required: false,
					Options: &schema.TextOptions{
						Max: types.Pointer(4),
					},
				},
				&schema.SchemaField{
					Name:     "language",
					Type:     schema.FieldTypeText,
					Required: false,
					Options: &schema.TextOptions{
						Max: types.Pointer(10),
					},
				},
			),
		}

		if err := dao.SaveCollection(profilesCollection); err != nil {
			return err
		}

		// Create playlists collection
		playlistsCollection := &models.Collection{
			Name:       "playlists",
			Type:       models.CollectionTypeBase,
			ListRule:   types.Pointer("user ~ @request.auth.id"),
			ViewRule:   types.Pointer("user ~ @request.auth.id"),
			CreateRule: types.Pointer("@request.auth.id != ''"),
			UpdateRule: types.Pointer("user ~ @request.auth.id"),
			DeleteRule: types.Pointer("user ~ @request.auth.id"),
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name:     "user",
					Type:     schema.FieldTypeRelation,
					Required: true,
					Options: &schema.RelationOptions{
						CollectionId:  usersCollection.Id,
						CascadeDelete: true,
					},
				},
				&schema.SchemaField{
					Name:     "name",
					Type:     schema.FieldTypeText,
					Required: true,
					Options: &schema.TextOptions{
						Min: types.Pointer(1),
						Max: types.Pointer(100),
					},
				},
				&schema.SchemaField{
					Name:     "url",
					Type:     schema.FieldTypeUrl,
					Required: false,
					Options:  &schema.UrlOptions{},
				},
				&schema.SchemaField{
					Name:     "auto_sync",
					Type:     schema.FieldTypeBool,
					Required: false,
					Options:  &schema.BoolOptions{},
				},
				&schema.SchemaField{
					Name:     "last_synced",
					Type:     schema.FieldTypeDate,
					Required: false,
					Options:  &schema.DateOptions{},
				},
			),
		}

		if err := dao.SaveCollection(playlistsCollection); err != nil {
			return err
		}

		// Create channels collection
		channelsCollection := &models.Collection{
			Name:       "channels",
			Type:       models.CollectionTypeBase,
			ListRule:   types.Pointer("playlist.user ~ @request.auth.id"),
			ViewRule:   types.Pointer("playlist.user ~ @request.auth.id"),
			CreateRule: types.Pointer("@request.auth.id != ''"),
			UpdateRule: types.Pointer("playlist.user ~ @request.auth.id"),
			DeleteRule: types.Pointer("playlist.user ~ @request.auth.id"),
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name:     "playlist",
					Type:     schema.FieldTypeRelation,
					Required: true,
					Options: &schema.RelationOptions{
						CollectionId:  playlistsCollection.Id,
						CascadeDelete: true,
					},
				},
				&schema.SchemaField{
					Name:     "name",
					Type:     schema.FieldTypeText,
					Required: true,
					Options: &schema.TextOptions{
						Min: types.Pointer(1),
						Max: types.Pointer(200),
					},
				},
				&schema.SchemaField{
					Name:     "url",
					Type:     schema.FieldTypeText,
					Required: true,
					Options: &schema.TextOptions{
						Max: types.Pointer(2000),
					},
				},
				&schema.SchemaField{
					Name:     "tvg_id",
					Type:     schema.FieldTypeText,
					Required: false,
					Options: &schema.TextOptions{
						Max: types.Pointer(200),
					},
				},
				&schema.SchemaField{
					Name:     "tvg_name",
					Type:     schema.FieldTypeText,
					Required: false,
					Options: &schema.TextOptions{
						Max: types.Pointer(200),
					},
				},
				&schema.SchemaField{
					Name:     "tvg_logo",
					Type:     schema.FieldTypeUrl,
					Required: false,
					Options:  &schema.UrlOptions{},
				},
				&schema.SchemaField{
					Name:     "group_title",
					Type:     schema.FieldTypeText,
					Required: false,
					Options: &schema.TextOptions{
						Max: types.Pointer(100),
					},
				},
			),
		}

		if err := dao.SaveCollection(channelsCollection); err != nil {
			return err
		}

		// Create favorites collection
		favoritesCollection := &models.Collection{
			Name:       "favorites",
			Type:       models.CollectionTypeBase,
			ListRule:   types.Pointer("profile.user ~ @request.auth.id"),
			ViewRule:   types.Pointer("profile.user ~ @request.auth.id"),
			CreateRule: types.Pointer("@request.auth.id != ''"),
			UpdateRule: types.Pointer("profile.user ~ @request.auth.id"),
			DeleteRule: types.Pointer("profile.user ~ @request.auth.id"),
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name:     "profile",
					Type:     schema.FieldTypeRelation,
					Required: true,
					Options: &schema.RelationOptions{
						CollectionId:  profilesCollection.Id,
						CascadeDelete: true,
					},
				},
				&schema.SchemaField{
					Name:     "channel",
					Type:     schema.FieldTypeRelation,
					Required: true,
					Options: &schema.RelationOptions{
						CollectionId:  channelsCollection.Id,
						CascadeDelete: true,
					},
				},
				&schema.SchemaField{
					Name:     "sort_order",
					Type:     schema.FieldTypeNumber,
					Required: false,
					Options:  &schema.NumberOptions{},
				},
			),
		}

		if err := dao.SaveCollection(favoritesCollection); err != nil {
			return err
		}

		// Create watch_history collection
		watchHistoryCollection := &models.Collection{
			Name:       "watch_history",
			Type:       models.CollectionTypeBase,
			ListRule:   types.Pointer("profile.user ~ @request.auth.id"),
			ViewRule:   types.Pointer("profile.user ~ @request.auth.id"),
			CreateRule: types.Pointer("@request.auth.id != ''"),
			UpdateRule: types.Pointer("profile.user ~ @request.auth.id"),
			DeleteRule: types.Pointer("profile.user ~ @request.auth.id"),
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name:     "profile",
					Type:     schema.FieldTypeRelation,
					Required: true,
					Options: &schema.RelationOptions{
						CollectionId:  profilesCollection.Id,
						CascadeDelete: true,
					},
				},
				&schema.SchemaField{
					Name:     "channel",
					Type:     schema.FieldTypeRelation,
					Required: true,
					Options: &schema.RelationOptions{
						CollectionId:  channelsCollection.Id,
						CascadeDelete: true,
					},
				},
				&schema.SchemaField{
					Name:     "watched_at",
					Type:     schema.FieldTypeDate,
					Required: true,
					Options:  &schema.DateOptions{},
				},
				&schema.SchemaField{
					Name:     "duration",
					Type:     schema.FieldTypeNumber,
					Required: false,
					Options:  &schema.NumberOptions{},
				},
			),
		}

		if err := dao.SaveCollection(watchHistoryCollection); err != nil {
			return err
		}

		// Create categories collection
		categoriesCollection := &models.Collection{
			Name:       "categories",
			Type:       models.CollectionTypeBase,
			ListRule:   types.Pointer("user ~ @request.auth.id"),
			ViewRule:   types.Pointer("user ~ @request.auth.id"),
			CreateRule: types.Pointer("@request.auth.id != ''"),
			UpdateRule: types.Pointer("user ~ @request.auth.id"),
			DeleteRule: types.Pointer("user ~ @request.auth.id"),
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name:     "user",
					Type:     schema.FieldTypeRelation,
					Required: true,
					Options: &schema.RelationOptions{
						CollectionId:  usersCollection.Id,
						CascadeDelete: true,
					},
				},
				&schema.SchemaField{
					Name:     "name",
					Type:     schema.FieldTypeText,
					Required: true,
					Options: &schema.TextOptions{
						Min: types.Pointer(1),
						Max: types.Pointer(50),
					},
				},
				&schema.SchemaField{
					Name:     "slug",
					Type:     schema.FieldTypeText,
					Required: true,
					Options: &schema.TextOptions{
						Max: types.Pointer(50),
					},
				},
				&schema.SchemaField{
					Name:     "icon",
					Type:     schema.FieldTypeText,
					Required: false,
					Options: &schema.TextOptions{
						Max: types.Pointer(50),
					},
				},
				&schema.SchemaField{
					Name:     "sort_order",
					Type:     schema.FieldTypeNumber,
					Required: false,
					Options:  &schema.NumberOptions{},
				},
			),
		}

		if err := dao.SaveCollection(categoriesCollection); err != nil {
			return err
		}

		return nil
	}, func(db dbx.Builder) error {
		dao := daos.New(db)

		// Rollback: delete created collections
		collections := []string{"categories", "watch_history", "favorites", "channels", "playlists", "profiles"}
		for _, name := range collections {
			collection, err := dao.FindCollectionByNameOrId(name)
			if err == nil {
				if err := dao.DeleteCollection(collection); err != nil {
					return err
				}
			}
		}

		// Remove TOTP fields from users
		usersCollection, err := dao.FindCollectionByNameOrId("users")
		if err == nil {
			fieldsToRemove := []string{"totp_enabled", "totp_secret", "totp_secret_pending", "totp_verified_at"}
			for _, fieldName := range fieldsToRemove {
				usersCollection.Schema.RemoveField(fieldName)
			}
			if err := dao.SaveCollection(usersCollection); err != nil {
				return err
			}
		}

		return nil
	})
}
